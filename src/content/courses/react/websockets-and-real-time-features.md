---
publishDate: 2026-05-28T10:20
title: Real-time UIs with WebSockets and SSE
slug: websockets-and-real-time-features
metadescription: Push live updates into React with WebSockets, Server-Sent Events or polling, and handle reconnection properly.
updateDate: 2026-09-05T10:20
author: ['bishal-biswas']
level: 4
tags: ['realtime', 'websockets', 'architecture']
course: react
---

## Pick the simplest thing that works

Three options, in increasing complexity.

**Polling.** Ask periodically. Trivial, works everywhere, and fine for anything that changes every few seconds or slower.

**Server-Sent Events.** The server pushes to the browser over one HTTP connection. One directional, auto reconnecting, and much simpler than WebSockets.

**WebSockets.** A full two way connection. Necessary for chat, collaborative editing and multiplayer.

Most "real-time" features are perfectly served by polling. Reach for the others when you have measured a need.

## Polling

```javascript
function useNotifications() {
  const { data } = useQuery({
    queryKey: ['notifications'],
    queryFn: fetchNotifications,
    refetchInterval: 30_000,
    refetchIntervalInBackground: false
  });
  return data ?? [];
}
```

One option on an existing query. `refetchIntervalInBackground: false` stops polling in a hidden tab, which saves battery and server load.

TanStack Query also refetches on window focus by default, which covers most of what users perceive as "live".

## Server-Sent Events

```javascript
function useEventStream(url) {
  const [events, setEvents] = useState([]);
  const [status, setStatus] = useState('connecting');
  useEffect(() => {
    const source = new EventSource(url, { withCredentials: true });
    source.onopen = () => setStatus('open');
    source.onmessage = (event) => {
      setEvents((current) => [...current, JSON.parse(event.data)]);
    };
    source.addEventListener('notification', (event) => {
      setEvents((current) => [...current, JSON.parse(event.data)]);
    });
    source.onerror = () => setStatus('reconnecting');
    return () => source.close();
  }, [url]);
  return { events, status };
}
```

`EventSource` **reconnects automatically**, which is the main reason to prefer it over WebSockets when you only need server to client. You get that for free instead of writing it.

Note `source.close()` in the cleanup. Without it, every remount opens another connection.

The server side is plain HTTP:

```javascript
export async function GET() {
  const stream = new ReadableStream({
    start(controller) {
      const send = (data) =>
        controller.enqueue(
          new TextEncoder().encode(`data: ${JSON.stringify(data)}\n\n`)
        );
      const id = setInterval(() => send({ time: Date.now() }), 1000);
      return () => clearInterval(id);
    }
  });
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive'
    }
  });
}
```

## WebSockets

```javascript
function useWebSocket(url) {
  const [status, setStatus] = useState('connecting');
  const [lastMessage, setLastMessage] = useState(null);
  const socketRef = useRef(null);
  const reconnectRef = useRef(0);
  useEffect(() => {
    let cancelled = false;
    let timer;
    function connect() {
      if (cancelled) return;
      const socket = new WebSocket(url);
      socketRef.current = socket;
      socket.onopen = () => {
        setStatus('open');
        reconnectRef.current = 0;
      };
      socket.onmessage = (event) => setLastMessage(JSON.parse(event.data));
      socket.onclose = () => {
        if (cancelled) return;
        setStatus('reconnecting');
        const attempt = reconnectRef.current++;
        const delay = Math.min(1000 * 2 ** attempt, 30_000);
        const jitter = Math.random() * 1000;
        timer = setTimeout(connect, delay + jitter);
      };
      socket.onerror = () => socket.close();
    }
    connect();
    return () => {
      cancelled = true;
      clearTimeout(timer);
      socketRef.current?.close();
    };
  }, [url]);
  const send = useCallback((data) => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify(data));
    }
  }, []);
  return { status, lastMessage, send };
}
```

Four things this gets right, and hand rolled versions usually do not:

- **Exponential backoff.** Reconnecting every 100ms after a server restart makes the outage worse.
- **Jitter.** Without it, every client reconnects at the same instant and knocks the server over again.
- **A `cancelled` flag.** Otherwise a reconnect fires after unmount.
- **A readyState check** before sending, since sending on a closed socket throws.

## Merging into your cache

Do not keep live data in a separate place from fetched data.

```javascript
function useLiveMessages(roomId) {
  const queryClient = useQueryClient();
  const { lastMessage } = useWebSocket(`wss://api.example.com/rooms/${roomId}`);
  useEffect(() => {
    if (!lastMessage) return;
    if (lastMessage.type === 'message') {
      queryClient.setQueryData(['messages', roomId], (old = []) => [
        ...old,
        lastMessage.payload
      ]);
    }
    if (lastMessage.type === 'message_deleted') {
      queryClient.setQueryData(['messages', roomId], (old = []) =>
        old.filter((m) => m.id !== lastMessage.payload.id)
      );
    }
  }, [lastMessage, queryClient, roomId]);
  return useQuery({
    queryKey: ['messages', roomId],
    queryFn: () => fetchMessages(roomId)
  });
}
```

The initial load comes from the query, and live events patch the same cache. One source of truth, and the component does not care which produced a message.

## Show the connection state

```javascript
function ConnectionBanner({ status }) {
  if (status === 'open') return null;
  return (
    <div role="status" aria-live="polite" className="banner">
      {status === 'reconnecting' ? 'Reconnecting...' : 'Connecting...'}
    </div>
  );
}
```

A disconnected app that looks connected is worse than one that says so. Users tolerate a problem they can see.

## Pause when hidden

```javascript
useEffect(() => {
  function handleVisibility() {
    if (document.hidden) {
      socketRef.current?.close();
    } else {
      connect();
    }
  }
  document.addEventListener('visibilitychange', handleVisibility);
  return () => document.removeEventListener('visibilitychange', handleVisibility);
}, []);
```

Nobody needs live updates in a tab they cannot see. This saves real battery on mobile.

## Use a library for anything serious

Hand rolled WebSocket handling misses things: heartbeats to detect a silently dead connection, message queueing while offline, ordering guarantees, and presence.

**Socket.IO** adds rooms, fallbacks and reconnection. **Pusher**, **Ably** and **Supabase Realtime** are hosted. **PartyKit** and **Liveblocks** target collaborative editing.

For collaborative text specifically, you want a CRDT such as **Yjs**. Do not attempt conflict resolution yourself.

## Quick recap

- Polling is enough for most "real-time" features.
- SSE is one directional and reconnects automatically.
- WebSockets are two way and you own reconnection.
- Use exponential backoff with jitter, or you take your own server down.
- Guard against reconnecting after unmount, and check `readyState` before sending.
- Merge live events into the same cache as fetched data.
- Show the connection status, and pause when the tab is hidden.
- Use a library for heartbeats, presence and collaborative editing.

<code id="code-content" class="language-javascript">
import { useState, useEffect, useRef, useCallback } from 'react';
// SSE reconnects AUTOMATICALLY, which is the main reason to prefer it
// when you only need server to client
function useEventStream(url) {
  const [events, setEvents] = useState([]);
  const [status, setStatus] = useState('connecting');
  useEffect(() =&gt; {
    const source = new EventSource(url, { withCredentials: true });
    source.onopen = () =&gt; setStatus('open');
    source.onmessage = (event) =&gt;
      setEvents((current) =&gt; [...current, JSON.parse(event.data)]);
    source.onerror = () =&gt; setStatus('reconnecting');
    return () =&gt; source.close();     // or every remount opens another
  }, [url]);
  return { events, status };
}
// WEBSOCKETS: you own reconnection, and getting it right matters
function useWebSocket(url) {
  const [status, setStatus] = useState('connecting');
  const [lastMessage, setLastMessage] = useState(null);
  const socketRef = useRef(null);
  const attemptRef = useRef(0);
  useEffect(() =&gt; {
    let cancelled = false;
    let timer;
    function connect() {
      if (cancelled) return;         // never reconnect after unmount
      const socket = new WebSocket(url);
      socketRef.current = socket;
      socket.onopen = () =&gt; { setStatus('open'); attemptRef.current = 0; };
      socket.onmessage = (event) =&gt; setLastMessage(JSON.parse(event.data));
      socket.onclose = () =&gt; {
        if (cancelled) return;
        setStatus('reconnecting');
        // EXPONENTIAL BACKOFF, capped. Retrying every 100ms after a
        // server restart makes the outage worse.
        const delay = Math.min(1000 * 2 ** attemptRef.current++, 30000);
        // JITTER, or every client reconnects at the same instant and
        // knocks the server over again
        timer = setTimeout(connect, delay + Math.random() * 1000);
      };
      socket.onerror = () =&gt; socket.close();
    }
    connect();
    return () =&gt; {
      cancelled = true;
      clearTimeout(timer);
      socketRef.current?.close();
    };
  }, [url]);
  const send = useCallback((data) =&gt; {
    // Sending on a closed socket throws
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify(data));
    }
  }, []);
  return { status, lastMessage, send };
}
// MERGE live events into the SAME cache as your fetched data, so there
// is one source of truth and the component does not care which is which
function useLiveMessages(roomId, queryClient) {
  const { lastMessage, status } = useWebSocket('wss://api.example.com/' + roomId);
  useEffect(() =&gt; {
    if (lastMessage?.type === 'message') {
      queryClient.setQueryData(['messages', roomId], (old = []) =&gt; [
        ...old,
        lastMessage.payload
      ]);
    }
  }, [lastMessage, queryClient, roomId]);
  return status;
}
// SHOW THE STATUS. A disconnected app that looks connected is worse
// than one that admits it.
function ConnectionBanner({ status }) {
  if (status === 'open') return null;
  return &lt;div role="status" aria-live="polite"&gt;Reconnecting...&lt;/div&gt;;
}
// AND START WITH POLLING. Most "real-time" features are well served by
// refetchInterval plus refetch on focus, with none of the above.
</code></pre>
