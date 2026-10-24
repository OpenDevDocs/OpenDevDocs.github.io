---
publishDate: 2026-05-23T10:05
title: List Virtualisation
slug: list-virtualisation
metadescription: Render only the rows on screen so a list of fifty thousand items scrolls as smoothly as one with ten.
updateDate: 2026-09-05T10:05
author: ['bishal-biswas']
level: 3
tags: ['performance', 'lists']
course: react
---

## The problem

```javascript
function ContactList({ contacts }) {
  return (
    <ul>
      {contacts.map((c) => <ContactRow key={c.id} contact={c} />)}
    </ul>
  );
}
```

With 50 contacts this is perfect. With 50,000 it creates 50,000 DOM nodes, and probably several hundred thousand once each row has an avatar, a name and a couple of buttons.

The browser has to lay out, style and paint all of them. Memory climbs, the initial render takes seconds, and scrolling stutters.

No amount of memoization helps. The problem is not React re-rendering, it is the sheer number of DOM nodes.

## The idea

The user can only see about 20 rows at once. So render 20, plus a few above and below, and fake the scrollbar.

As they scroll, swap which 20 you render and move them into position. The DOM stays small no matter how long the list is.

This is **virtualisation**, sometimes called windowing.

## Using a library

Do not write this yourself. The edge cases around scroll anchoring, resizing and accessibility are genuinely hard.

```bash
npm install @tanstack/react-virtual
```

```javascript
import { useVirtualizer } from '@tanstack/react-virtual';
import { useRef } from 'react';
function ContactList({ contacts }) {
  const parentRef = useRef(null);
  const virtualizer = useVirtualizer({
    count: contacts.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 64,
    overscan: 5
  });
  return (
    <div ref={parentRef} style={{ height: 600, overflow: 'auto' }}>
      <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
        {virtualizer.getVirtualItems().map((virtualRow) => (
          <div
            key={virtualRow.key}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: virtualRow.size,
              transform: `translateY(${virtualRow.start}px)`
            }}
          >
            <ContactRow contact={contacts[virtualRow.index]} />
          </div>
        ))}
      </div>
    </div>
  );
}
```

Three pieces:

- **The scroll container** with a fixed height and `overflow: auto`.
- **An inner element** whose height is the total, which creates the scrollbar.
- **Absolutely positioned rows**, moved into place with `transform`.

`overscan` renders a few extra rows outside the viewport, so fast scrolling does not show blank space.

## Variable heights

```javascript
const virtualizer = useVirtualizer({
  count: items.length,
  getScrollElement: () => parentRef.current,
  estimateSize: () => 100,
  measureElement: (element) => element.getBoundingClientRect().height
});
```

```javascript
<div ref={virtualizer.measureElement} data-index={virtualRow.index}>
  <Comment comment={comments[virtualRow.index]} />
</div>
```

The estimate is used until a row has been measured. Rows of unknown height, such as comments, work but scroll positioning is less precise, so make the estimate a reasonable average.

## Infinite scrolling

```javascript
const virtualItems = virtualizer.getVirtualItems();
useEffect(() => {
  const last = virtualItems.at(-1);
  if (!last) return;
  if (last.index >= items.length - 1 && hasNextPage && !isFetchingNextPage) {
    fetchNextPage();
  }
}, [virtualItems, items.length, hasNextPage, isFetchingNextPage, fetchNextPage]);
```

When the last virtual row is near the end of the loaded data, fetch the next page. Combined with `useInfiniteQuery` this handles feeds of any length.

## Accessibility

This is where virtualisation costs you something, and it is often ignored.

Screen readers cannot see rows that are not in the DOM. Announce the total:

```javascript
<div
  role="list"
  aria-label={`Contacts, ${contacts.length} items`}
  aria-rowcount={contacts.length}
>
  {virtualItems.map((virtualRow) => (
    <div role="listitem" aria-rowindex={virtualRow.index + 1} key={virtualRow.key}>
      <ContactRow contact={contacts[virtualRow.index]} />
    </div>
  ))}
</div>
```

`aria-rowcount` and `aria-rowindex` tell assistive technology the real size and position, even though only a slice exists.

Keyboard navigation also needs thought. Tabbing to a row that is not rendered is impossible, so provide search or jump to controls rather than relying on tabbing through 50,000 items.

Browser find in page will not find unrendered rows either. If that matters, provide your own search.

## Try the alternatives first

Virtualisation adds real complexity. Before reaching for it:

**Paginate.** Twenty per page with next and previous is simpler, more accessible, and often what users prefer. It also lets you fetch less.

**Search and filter.** Nobody scrolls 50,000 rows looking for something. A search box is more useful than a fast list.

**`content-visibility`.** One CSS property that skips rendering off screen elements:

```css
.row {
  content-visibility: auto;
  contain-intrinsic-size: auto 64px;
}
```

This gives you a lot of the benefit with none of the JavaScript, and it keeps all the rows in the DOM, so find in page and screen readers still work. Support is good in Chromium and improving elsewhere. **Try this first.**

## When it is worth it

- A genuinely long list, in the thousands.
- Scrolling is the primary interaction, as in a chat, a feed or a data grid.
- Pagination would harm the experience.
- You have measured and confirmed the DOM size is the bottleneck.

## Quick recap

- Long lists are slow because of DOM node count, not React.
- Virtualisation renders only visible rows plus overscan.
- Use a library, since the edge cases are hard.
- You need a scroll container, a sized inner element, and positioned rows.
- Variable heights work with an estimate plus measurement.
- Announce the real count with `aria-rowcount` for screen readers.
- Find in page cannot see unrendered rows, so provide search.
- Try pagination, filtering and `content-visibility` first.

<code id="code-content" class="language-javascript">
import { useRef, useEffect } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
// 50,000 rows means 50,000 DOM nodes to lay out, style and paint.
// No amount of memoization helps, because React is not the bottleneck.
// Virtualisation renders only what is visible.
export default function ContactList({ contacts, fetchNextPage, hasNextPage }) {
  const parentRef = useRef(null);
  const virtualizer = useVirtualizer({
    count: contacts.length,
    getScrollElement: () =&gt; parentRef.current,
    estimateSize: () =&gt; 64,        // row height, or an average
    overscan: 5                    // extra rows so fast scrolling is smooth
  });
  const virtualItems = virtualizer.getVirtualItems();
  // Infinite scroll: fetch when the last rendered row nears the end
  useEffect(() =&gt; {
    const last = virtualItems.at(-1);
    if (last &amp;&amp; last.index &gt;= contacts.length - 1 &amp;&amp; hasNextPage) {
      fetchNextPage();
    }
  }, [virtualItems, contacts.length, hasNextPage, fetchNextPage]);
  return (
    // 1. The scroll container: fixed height, overflow auto
    &lt;div ref={parentRef} style={{ height: 600, overflow: 'auto' }}&gt;
      {/* 2. An inner element of the FULL height, which creates the
             scrollbar even though most rows do not exist */}
      &lt;div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}&gt;
        {/* 3. Only the visible rows, absolutely positioned. ARIA tells
               screen readers the real count and position, since they
               cannot see rows that are not in the DOM. */}
        &lt;div role="list" aria-rowcount={contacts.length}
             aria-label={'Contacts, ' + contacts.length + ' items'}&gt;
          {virtualItems.map((virtualRow) =&gt; (
            &lt;div
              key={virtualRow.key}
              role="listitem"
              aria-rowindex={virtualRow.index + 1}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: virtualRow.size,
                transform: 'translateY(' + virtualRow.start + 'px)'
              }}
            &gt;
              &lt;ContactRow contact={contacts[virtualRow.index]} /&gt;
            &lt;/div&gt;
          ))}
        &lt;/div&gt;
      &lt;/div&gt;
    &lt;/div&gt;
  );
}
// TRY THESE FIRST, because virtualisation costs real complexity:
// 1. Paginate. Simpler, more accessible, and fetches less data.
// 2. Add search and filtering. Nobody scrolls 50,000 rows looking for
//    something, so a search box is more useful than a fast list.
// 3. content-visibility, one CSS property with most of the benefit and
//    none of the JavaScript. Rows stay in the DOM, so find in page and
//    screen readers keep working:
//      .row { content-visibility: auto; contain-intrinsic-size: auto 64px; }
</code></pre>
