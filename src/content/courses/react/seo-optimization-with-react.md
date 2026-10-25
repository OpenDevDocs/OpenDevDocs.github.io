---
publishDate: 2026-05-29T10:24
title: SEO and Core Web Vitals
slug: seo-optimization-with-react
metadescription: Make a React site that search engines and social platforms can actually read, and hit the metrics that reflect real experience.
updateDate: 2026-09-05T10:24
author: ['bishal-biswas']
level: 4
tags: ['seo', 'performance', 'web-vitals']
course: react
---

## The fundamental problem

A client rendered React app sends this:

```html
<div id="root"></div>
<script src="/app.js"></script>
```

There is no content until JavaScript downloads and runs.

Google generally executes JavaScript, so it usually sees your content, though rendering is queued and can lag by days. **Other crawlers largely do not.** Bing is inconsistent, and the scrapers behind Facebook, LinkedIn, Slack, WhatsApp and Twitter previews do not run JavaScript at all.

So a client rendered page shared on social media shows your fallback title and no image, no matter how good your metadata code is.

**If SEO or link previews matter, you need server rendering.** Everything else on this page is secondary to that.

## Choose a rendering strategy

- **Static generation** for content that rarely changes. Fastest, and perfectly crawlable.
- **ISR** for content that updates periodically.
- **SSR** for personalised pages.
- **Client rendering** for anything behind a login, where SEO is irrelevant.

An app with a public marketing site and a private dashboard should use different strategies for each. Both live happily in one framework.

## Metadata

React 19 hoists these automatically, and with server rendering they reach crawlers.

```javascript
export async function generateMetadata({ params }) {
  const { slug } = await params;
  const article = await getArticle(slug);
  if (!article) return { title: 'Not found' };
  const url = `https://example.com/blog/${slug}`;
  return {
    title: article.title,
    description: article.excerpt,
    alternates: { canonical: url },
    openGraph: {
      title: article.title,
      description: article.excerpt,
      url,
      type: 'article',
      publishedTime: article.publishedAt,
      images: [{ url: article.coverImage, width: 1200, height: 630 }]
    },
    twitter: { card: 'summary_large_image' }
  };
}
```

A few rules that matter:

- **Every page needs a unique title and description.** Duplicates across pages actively hurt.
- **Canonical URLs** prevent duplicate content from query strings and trailing slashes.
- **`og:image` should be 1200 by 630.** Get this wrong and your link preview is a cropped mess.

## Semantic markup

```javascript
<div className="header">
  <div className="title">Article title</div>
  <div className="body">...</div>
</div>
```

```javascript
<article>
  <h1>Article title</h1>
  <time dateTime={article.publishedAt}>
    {formatDate(article.publishedAt)}
  </time>
  <p>{article.body}</p>
</article>
```

Search engines infer structure from elements. A page of `div`s says nothing. One `<h1>` per page, headings in order, and real `<a href>` elements for links, since a `div` with an `onClick` is not a link and will not be followed.

## Structured data

```javascript
function ArticleSchema({ article }) {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: article.title,
    datePublished: article.publishedAt,
    dateModified: article.updatedAt,
    author: { '@type': 'Person', name: article.author.name },
    image: article.coverImage
  };
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}
```

This produces rich results: star ratings, prices, breadcrumbs, FAQ accordions. Test with Google's Rich Results tool, which tells you exactly what is missing.

## Core Web Vitals

Three metrics that map to what users feel.

### LCP, under 2.5 seconds

How long until the main content appears. Usually the hero image or the headline.

```javascript
<img
  src={hero}
  alt="..."
  width={1200}
  height={600}
  fetchPriority="high"
/>
```

```javascript
import { preload } from 'react-dom';
preload(heroImage, { as: 'image', fetchPriority: 'high' });
```

**Never lazy load the LCP element.** Adding `loading="lazy"` to your hero image delays the exact thing being measured, which is a surprisingly common own goal.

### INP, under 200 milliseconds

How quickly the page responds to interaction. Long tasks are the enemy.

```javascript
const [isPending, startTransition] = useTransition();
function handleFilter(value) {
  setQuery(value);
  startTransition(() => setFilter(value));
}
```

Transitions, `useDeferredValue`, code splitting and virtualisation all help here.

### CLS, under 0.1

How much the layout jumps.

```javascript
<img src={photo} alt="" />
<img src={photo} alt="" width={800} height={600} />
```

Always set dimensions, reserve space for ads and banners, and use `font-display: optional` or preload fonts so text does not reflow when the font arrives.

Measure them in the field:

```javascript
import { onLCP, onINP, onCLS } from 'web-vitals';
onLCP(sendToAnalytics);
onINP(sendToAnalytics);
onCLS(sendToAnalytics);
```

Lab tests on your laptop are optimistic. Real user data on real phones is what Google uses.

## Crawlability

```javascript
export default function sitemap() {
  return articles.map((article) => ({
    url: `https://example.com/blog/${article.slug}`,
    lastModified: article.updatedAt,
    changeFrequency: 'weekly',
    priority: 0.7
  }));
}
```

```javascript
export default function robots() {
  return {
    rules: { userAgent: '*', allow: '/', disallow: '/admin/' },
    sitemap: 'https://example.com/sitemap.xml'
  };
}
```

Also worth checking:

- Are you accidentally serving `noindex`? It happens on staging and gets deployed.
- Do you have a redirect loop between trailing and non trailing slashes?
- Is pagination crawlable, or does it need JavaScript to reach page two?

## Test what crawlers see

```bash
curl -s https://example.com/blog/my-article | grep -o '<title>.*</title>'
```

If your title is not in the raw HTML, crawlers that do not run JavaScript do not see it either.

Also use:

- **Google Search Console**, URL Inspection, to see the rendered page.
- **Rich Results Test** for structured data.
- The social platforms' own **link preview debuggers**.
- **PageSpeed Insights** for field Core Web Vitals data.

## Quick recap

- Client rendered pages are invisible to most crawlers and every social scraper.
- Server rendering is the prerequisite, and everything else is secondary.
- Every page needs a unique title, description and canonical URL.
- `og:image` at 1200 by 630 controls your link previews.
- Semantic elements and one `h1` per page tell crawlers your structure.
- Structured data produces rich results.
- Never lazy load the LCP element, and always set image dimensions.
- Measure Core Web Vitals in the field, not on your laptop.

<code id="code-content" class="language-javascript">
import { preload } from 'react-dom';
import { onLCP, onINP, onCLS } from 'web-vitals';
// THE PREREQUISITE: a client rendered page sends an empty div. Google
// usually runs JavaScript eventually, but Facebook, LinkedIn, Slack and
// WhatsApp link scrapers do NOT. Server rendering comes first.
export async function generateMetadata({ params }) {
  const { slug } = await params;
  const article = await getArticle(slug);
  const url = 'https://example.com/blog/' + slug;
  return {
    // Unique per page. Duplicates across pages actively hurt.
    title: article.title,
    description: article.excerpt,
    alternates: { canonical: url },     // prevents duplicate content
    openGraph: {
      title: article.title,
      description: article.excerpt,
      url,
      type: 'article',
      // 1200 x 630, or your link preview is a cropped mess
      images: [{ url: article.coverImage, width: 1200, height: 630 }]
    },
    twitter: { card: 'summary_large_image' }
  };
}
export default async function ArticlePage({ params }) {
  const { slug } = await params;
  const article = await getArticle(slug);
  // Start the LCP image immediately, at high priority
  preload(article.coverImage, { as: 'image', fetchPriority: 'high' });
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: article.title,
    datePublished: article.publishedAt,
    author: { '@type': 'Person', name: article.author.name }
  };
  return (
    // Semantic elements, not a page of divs. One h1, headings in order,
    // and real &lt;a href&gt; links, because a div with onClick is not a link.
    &lt;article&gt;
      &lt;script type="application/ld+json"
              dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} /&gt;
      &lt;h1&gt;{article.title}&lt;/h1&gt;
      &lt;time dateTime={article.publishedAt}&gt;{article.publishedAt}&lt;/time&gt;
      {/* NEVER lazy load the LCP element. Adding loading="lazy" here
          delays the exact thing being measured. */}
      &lt;img src={article.coverImage} alt={article.title}
           width={1200} height={630} fetchPriority="high" /&gt;
      &lt;p&gt;{article.body}&lt;/p&gt;
      {/* Below the fold: lazy load, but ALWAYS set dimensions so the
          layout does not jump, which is what CLS measures */}
      {article.gallery.map((img) =&gt; (
        &lt;img key={img.id} src={img.url} alt="" loading="lazy"
             width={800} height={600} /&gt;
      ))}
    &lt;/article&gt;
  );
}
// MEASURE IN THE FIELD. Your laptop is optimistic, and real user data
// on real phones is what Google actually uses.
onLCP(sendToAnalytics);   // under 2.5s   main content visible
onINP(sendToAnalytics);   // under 200ms  responds to interaction
onCLS(sendToAnalytics);   // under 0.1    layout does not jump
// TEST WHAT CRAWLERS SEE. If the title is not in the raw HTML, the
// crawlers that do not run JavaScript never see it:
//   curl -s https://example.com/blog/post | grep -o '&lt;title&gt;.*&lt;/title&gt;'
</code></pre>
