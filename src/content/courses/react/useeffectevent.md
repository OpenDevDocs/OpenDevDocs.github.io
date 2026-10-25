---
publishDate: 2026-05-10T09:27
title: useEffectEvent for Non-reactive Logic
slug: useeffectevent
metadescription: Separate the reactive parts of an effect from the parts that should just read the latest value, without lying about dependencies.
updateDate: 2026-09-05T09:27
author: ['bishal-biswas']
level: 2
tags: ['hooks', 'effects', 'react-19']
course: react
---

## The problem it solves

Sometimes an effect needs to **read** a value without **reacting** to it.

```javascript
function ChatRoom({ roomId, theme }) {
  useEffect(() => {
    const connection = createConnection(roomId);
    connection.on('connected', () => {
      showNotification('Connected!', theme);
    });
    connection.connect();
    return () => connection.disconnect();
  }, [roomId, theme]);
}
```

The effect uses `theme`, so the linter insists it goes in the array. But now **changing the theme reconnects the chat**, which is clearly wrong. The user switches to dark mode and drops out of the room.

Remove `theme` from the array and you have a stale closure: the notification always uses whatever theme was current when you joined.

Neither option is right, and this shape appears constantly.

## useEffectEvent

React 19.2 added `useEffectEvent`, which extracts the non reactive part.

```javascript
import { useEffect, useEffectEvent } from 'react';
function ChatRoom({ roomId, theme }) {
  const onConnected = useEffectEvent(() => {
    showNotification('Connected!', theme);
  });
  useEffect(() => {
    const connection = createConnection(roomId);
    connection.on('connected', () => {
      onConnected();
    });
    connection.connect();
    return () => connection.disconnect();
  }, [roomId]);
}
```

Now:

- The effect depends only on `roomId`, so only a room change reconnects.
- `onConnected` always sees the **latest** `theme`, with no stale closure.
- The linter is happy, because effect events are deliberately excluded from the dependency array.

## The mental model

Split your effect into two kinds of code:

**Reactive**: things that should cause the effect to re-run. The room id, a user id, a URL.

**Non reactive**: things you want to read at the moment something happens. Analytics properties, the current theme, a callback prop.

`useEffectEvent` is where the non reactive part goes.

## More examples

### Analytics without re-firing

```javascript
function ProductPage({ productId, referrer, userTier }) {
  const logVisit = useEffectEvent(() => {
    analytics.track('product_viewed', { productId, referrer, userTier });
  });
  useEffect(() => {
    logVisit();
  }, [productId]);
}
```

Only a new product should log a visit. But when it does, you want the current `referrer` and `userTier`. Without this you either log duplicates or send stale values.

### Callback props that change identity

```javascript
function Timer({ onTick, interval }) {
  const handleTick = useEffectEvent(() => {
    onTick();
  });
  useEffect(() => {
    const id = setInterval(handleTick, interval);
    return () => clearInterval(id);
  }, [interval]);
}
```

If the parent passes a fresh arrow function each render, listing `onTick` restarts the timer constantly. This fixes it without forcing the parent to use `useCallback`.

### An interval reading fresh state

```javascript
function Poller({ url, filters }) {
  const [data, setData] = useState(null);
  const poll = useEffectEvent(async () => {
    const result = await fetchData(url, filters);
    setData(result);
  });
  useEffect(() => {
    const id = setInterval(poll, 5000);
    return () => clearInterval(id);
  }, []);
}
```

The interval is set up once, and every tick uses the current filters.

## The rules

Effect events have real restrictions.

**Only call them from inside an effect.** They are not general purpose callbacks.

```javascript
function Broken({ value }) {
  const onSomething = useEffectEvent(() => console.log(value));
  return <button onClick={onSomething}>Click</button>;
}
```

Use a normal function for event handlers. Handlers already see fresh values.

**Never pass them to another component.**

```javascript
const onTick = useEffectEvent(() => {});
return <Child onTick={onTick} />;
```

**Never put them in a dependency array.** They are stable, and the linter knows to leave them out.

```javascript
useEffect(() => {
  onConnected();
}, [roomId, onConnected]);
```

**Declare them in the same component as the effect that uses them.**

## Do not overuse it

`useEffectEvent` makes the linter quiet, which makes it tempting as a way to silence dependency warnings. Resist that.

Ask honestly: **should a change to this value re-run the effect?**

- Yes, it should re-run: keep it in the dependency array.
- No, I just want the latest value when something happens: use an effect event.

If most of your effect is inside an effect event, that is a sign the effect should not exist at all. Go back to the "you might not need an effect" checklist.

## Availability

`useEffectEvent` is stable from React 19.2. In earlier versions you may see it as `experimental_useEffectEvent`, or a hand rolled equivalent using a ref:

```javascript
function useLatest(value) {
  const ref = useRef(value);
  useLayoutEffect(() => {
    ref.current = value;
  });
  return ref;
}
```

That pattern was the common workaround before the official hook existed, and you will still meet it in older codebases.

## Quick recap

- Effects often read values they should not react to.
- Listing them causes needless re-runs, omitting them causes stale closures.
- `useEffectEvent` extracts the non reactive part and always sees fresh values.
- The effect then depends only on what should genuinely re-trigger it.
- Call effect events only from inside effects.
- Never pass them as props or list them as dependencies.
- If most of your effect is non reactive, question whether you need the effect.

<code id="code-content" class="language-javascript">
import { useEffect, useEffectEvent, useState } from 'react';
// THE PROBLEM: the effect reads theme, so the linter wants it listed.
// But then changing the theme would reconnect the chat and drop the user
// out of the room. Omitting it gives a stale closure instead.
function ChatRoom({ roomId, theme, onMessage }) {
  const [messages, setMessages] = useState([]);
  // Non reactive: read the LATEST theme when the event happens, but do
  // not re-run the effect when it changes.
  const onConnected = useEffectEvent(() =&gt; {
    showNotification('Connected to ' + roomId, theme);
  });
  const handleMessage = useEffectEvent((message) =&gt; {
    setMessages((previous) =&gt; [...previous, message]);
    onMessage(message);           // a prop that may change identity
  });
  useEffect(() =&gt; {
    const connection = createConnection(roomId);
    connection.on('connected', onConnected);
    connection.on('message', handleMessage);
    connection.connect();
    return () =&gt; connection.disconnect();
  }, [roomId]);                   // ONLY roomId. Effect events are
                                  // deliberately excluded from the array.
  return &lt;p&gt;{messages.length} messages in {roomId}&lt;/p&gt;;
}
// Analytics: fire once per product, but with the CURRENT referrer and tier
function ProductPage({ productId, referrer, userTier }) {
  const logVisit = useEffectEvent(() =&gt; {
    analytics.track('product_viewed', { productId, referrer, userTier });
  });
  useEffect(() =&gt; {
    logVisit();
  }, [productId]);                // only a new product logs a visit
  return &lt;p&gt;Product {productId}&lt;/p&gt;;
}
// A timer whose callback prop changes identity every render
function Timer({ onTick, interval }) {
  const handleTick = useEffectEvent(() =&gt; onTick());
  useEffect(() =&gt; {
    const id = setInterval(handleTick, interval);
    return () =&gt; clearInterval(id);
  }, [interval]);                 // the timer restarts only if the
  return null;                    // interval itself changes
}
// THE RULES
// 1. Call effect events only from inside an effect.
//    &lt;button onClick={onConnected}&gt;   WRONG, use a normal function
// 2. Never pass one to another component.
//    &lt;Child onTick={handleTick} /&gt;    WRONG
// 3. Never list one as a dependency. It is stable by design.
//    }, [roomId, onConnected]);       WRONG
// And if MOST of your effect ends up inside effect events, that is a
// sign the effect should not exist at all.
</code></pre>
