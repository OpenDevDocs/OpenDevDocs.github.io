---
publishDate: 2026-05-26T10:16
title: Render Props
slug: render-props-pattern
metadescription: Share behaviour by passing a function that returns markup, and know the few cases where it still beats a hook.
updateDate: 2026-09-05T10:16
author: ['bishal-biswas']
level: 3
tags: ['legacy', 'patterns', 'composition']
course: react
---

## The pattern

A component takes a **function** as a prop and calls it with data, letting the caller decide what to render.

```javascript
function MousePosition({ render }) {
  const [position, setPosition] = useState({ x: 0, y: 0 });
  useEffect(() => {
    function handleMove(event) {
      setPosition({ x: event.clientX, y: event.clientY });
    }
    window.addEventListener('mousemove', handleMove);
    return () => window.removeEventListener('mousemove', handleMove);
  }, []);
  return render(position);
}
function App() {
  return <MousePosition render={({ x, y }) => <p>Mouse at {x}, {y}</p>} />;
}
```

`MousePosition` owns the behaviour. The caller owns the markup.

Using `children` as the function is the more common form:

```javascript
function MousePosition({ children }) {
  return children(position);
}
function App() {
  return (
    <MousePosition>
      {({ x, y }) => <p>Mouse at {x}, {y}</p>}
    </MousePosition>
  );
}
```

## Why it existed

Before hooks, this and HOCs were the only ways to share stateful logic. Render props had one clear advantage over HOCs: **you can see where the values come from**.

```javascript
export default withMouse(withWindow(withTheme(Component)));
```

```javascript
<Mouse>
  {(mouse) => (
    <Window>
      {(window) => <Component mouse={mouse} window={window} />}
    </Window>
  )}
</Mouse>
```

No mystery props. But look at the shape. Three shared values means three levels of nesting, and this got the name **callback hell for components**.

## Hooks made it unnecessary

```javascript
function useMousePosition() {
  const [position, setPosition] = useState({ x: 0, y: 0 });
  useEffect(() => {
    function handleMove(event) {
      setPosition({ x: event.clientX, y: event.clientY });
    }
    window.addEventListener('mousemove', handleMove);
    return () => window.removeEventListener('mousemove', handleMove);
  }, []);
  return position;
}
function App() {
  const { x, y } = useMousePosition();
  const size = useWindowSize();
  const { theme } = useTheme();
  return <p>Mouse at {x}, {y}</p>;
}
```

Flat, obvious, and no nesting no matter how many values you need. For **sharing logic**, hooks win outright.

## Where it still fits

The pattern is not dead. It is right whenever the shared thing is **markup structure**, not just data. A hook cannot render anything around your content.

### Layout components

```javascript
function DataTable({ rows, columns, renderRow, renderEmpty }) {
  if (rows.length === 0) return renderEmpty?.() ?? <p>No data</p>;
  return (
    <table>
      <thead>
        <tr>{columns.map((c) => <th key={c.key}>{c.label}</th>)}</tr>
      </thead>
      <tbody>{rows.map((row) => renderRow(row))}</tbody>
    </table>
  );
}
<DataTable
  rows={users}
  columns={columns}
  renderRow={(user) => (
    <tr key={user.id}>
      <td>{user.name}</td>
      <td><Badge status={user.status} /></td>
    </tr>
  )}
  renderEmpty={() => <EmptyState message="No users yet" />}
/>
```

The table owns the structure and the empty handling. The caller owns each cell. A hook cannot do this.

### Measuring and providing

```javascript
function Measure({ children }) {
  const ref = useRef(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  useEffect(() => {
    const observer = new ResizeObserver(([entry]) => {
      setSize({
        width: entry.contentRect.width,
        height: entry.contentRect.height
      });
    });
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);
  return <div ref={ref}>{children(size)}</div>;
}
<Measure>
  {({ width }) => (width > 600 ? <WideChart /> : <NarrowChart />)}
</Measure>
```

The component must render the element it measures, so the ref and the render are inseparable.

### Virtualised lists

```javascript
<VirtualList
  items={items}
  itemHeight={64}
  renderItem={(item, index) => <Row item={item} index={index} />}
/>
```

The library owns the scroll container and positioning, you own each row.

You will see this API constantly in libraries, which is a good sign the pattern is right for that job.

## Do not overuse it

```javascript
<UserData>
  {(user) => (
    <Permissions user={user}>
      {(permissions) => (
        <Settings user={user} permissions={permissions}>
          {(settings) => <Panel user={user} settings={settings} />}
        </Settings>
      )}
    </Permissions>
  )}
</UserData>
```

That is the shape hooks exist to remove. If the components are only providing data, use hooks.

## A performance note

```javascript
<Measure>
  {({ width }) => <ExpensiveChart width={width} />}
</Measure>
```

A new function every render means the children re-render every time. With the React Compiler this is handled. Without it, and if the child is genuinely expensive, memoize the callback.

## The rule

**Sharing data or behaviour?** Use a hook.

**Sharing structure, or wrapping something you must also render?** Use a render prop, or `children`.

## Quick recap

- A render prop is a function prop returning markup.
- It shares behaviour while letting the caller own the markup.
- Unlike HOCs, the source of every value is visible.
- Nesting several of them is the shape hooks removed.
- For sharing logic, hooks win outright.
- It still fits when the component owns structure, as in tables and virtualised lists.
- It is also right when a ref and the rendering cannot be separated.
- Hook for data, render prop for structure.

<code id="code-content" class="language-javascript">
import { useState, useEffect, useRef } from 'react';
// WHERE RENDER PROPS STILL WIN: the component owns the STRUCTURE and
// the caller owns each cell. A hook cannot render anything around you.
function DataTable({ rows, columns, renderRow, renderEmpty }) {
  if (rows.length === 0) return renderEmpty?.() ?? &lt;p&gt;No data&lt;/p&gt;;
  return (
    &lt;table&gt;
      &lt;thead&gt;
        &lt;tr&gt;{columns.map((c) =&gt; &lt;th key={c.key}&gt;{c.label}&lt;/th&gt;)}&lt;/tr&gt;
      &lt;/thead&gt;
      &lt;tbody&gt;{rows.map((row) =&gt; renderRow(row))}&lt;/tbody&gt;
    &lt;/table&gt;
  );
}
// Also right when a ref and the rendering are inseparable: this
// component must render the very element it measures.
function Measure({ children }) {
  const ref = useRef(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  useEffect(() =&gt; {
    const observer = new ResizeObserver(([entry]) =&gt; {
      setSize({
        width: entry.contentRect.width,
        height: entry.contentRect.height
      });
    });
    if (ref.current) observer.observe(ref.current);
    return () =&gt; observer.disconnect();
  }, []);
  return &lt;div ref={ref}&gt;{children(size)}&lt;/div&gt;;
}
export default function Dashboard({ users, columns }) {
  return (
    &lt;div&gt;
      &lt;DataTable
        rows={users}
        columns={columns}
        renderRow={(user) =&gt; (
          &lt;tr key={user.id}&gt;
            &lt;td&gt;{user.name}&lt;/td&gt;
            &lt;td&gt;&lt;Badge status={user.status} /&gt;&lt;/td&gt;
          &lt;/tr&gt;
        )}
        renderEmpty={() =&gt; &lt;EmptyState message="No users yet" /&gt;}
      /&gt;
      &lt;Measure&gt;
        {({ width }) =&gt; (width &gt; 600 ? &lt;WideChart /&gt; : &lt;NarrowChart /&gt;)}
      &lt;/Measure&gt;
    &lt;/div&gt;
  );
}
// WHERE HOOKS WIN: sharing DATA. This nesting is exactly the shape
// hooks were created to remove.
//   &lt;Mouse&gt;
//     {(mouse) =&gt; (
//       &lt;Window&gt;
//         {(size) =&gt; &lt;Component mouse={mouse} size={size} /&gt;}
//       &lt;/Window&gt;
//     )}
//   &lt;/Mouse&gt;
// Flat, obvious, and it does not get worse as you add more:
function Flat() {
  const mouse = useMousePosition();
  const size = useWindowSize();
  const { theme } = useTheme();
  return &lt;p&gt;Mouse at {mouse.x}, {mouse.y}&lt;/p&gt;;
}
// THE RULE: hook for data and behaviour, render prop for structure.
</code></pre>
