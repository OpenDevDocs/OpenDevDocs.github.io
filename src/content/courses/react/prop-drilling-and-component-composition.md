---
publishDate: 2026-05-15T09:43
title: Prop Drilling and Component Composition
slug: prop-drilling-and-component-composition
metadescription: Composition solves most prop drilling without Context, by passing rendered elements instead of the data to render them.
updateDate: 2026-09-05T09:43
author: ['bishal-biswas']
level: 2
tags: ['patterns', 'composition']
course: react
---

## Prop drilling

```javascript
function App() {
  const [user, setUser] = useState(null);
  return <Layout user={user} />;
}
function Layout({ user }) {
  return <Sidebar user={user} />;
}
function Sidebar({ user }) {
  return <UserPanel user={user} />;
}
function UserPanel({ user }) {
  return <p>{user.name}</p>;
}
```

`Layout` and `Sidebar` do not use `user`. They only pass it along.

This is annoying rather than fatal. But it means adding a field touches four files, and every intermediate component is coupled to data it does not care about.

The instinct is to reach for Context. Often there is a simpler answer.

## Composition

Instead of passing the **data** down, pass the **rendered element** down.

```javascript
function App() {
  const [user, setUser] = useState(null);
  return (
    <Layout sidebar={<UserPanel user={user} />} />
  );
}
function Layout({ sidebar }) {
  return (
    <div className="layout">
      <aside>{sidebar}</aside>
      <main>Content</main>
    </div>
  );
}
function UserPanel({ user }) {
  return <p>{user.name}</p>;
}
```

`Layout` no longer knows `user` exists. It receives something to render and puts it in a slot.

The chain went from four components knowing about `user` to two: the one with the data and the one displaying it.

## Why this works

JSX is a value. `<UserPanel user={user} />` is created where `user` is in scope, so it already has what it needs by the time `Layout` receives it.

`Layout` becomes genuinely reusable, because it makes no assumptions about its contents.

## Using children

The same idea with the most common prop of all.

```javascript
function Card({ title, children }) {
  return (
    <div className="card">
      <h2>{title}</h2>
      <div className="card-body">{children}</div>
    </div>
  );
}
function Dashboard() {
  const [stats, setStats] = useState(null);
  return (
    <Card title="Statistics">
      <StatsChart stats={stats} />
    </Card>
  );
}
```

`Card` never hears about `stats`.

## Several slots

```javascript
function PageLayout({ header, sidebar, children, footer }) {
  return (
    <div className="page">
      <header>{header}</header>
      <div className="body">
        <aside>{sidebar}</aside>
        <main>{children}</main>
      </div>
      <footer>{footer}</footer>
    </div>
  );
}
function ProductPage({ product }) {
  return (
    <PageLayout
      header={<Breadcrumbs product={product} />}
      sidebar={<CategoryNav categoryId={product.categoryId} />}
      footer={<RelatedProducts ids={product.relatedIds} />}
    >
      <ProductDetail product={product} />
    </PageLayout>
  );
}
```

`PageLayout` is pure structure. Every piece of data stays with the component that needs it.

## Compound components

For a group that shares state, expose the parts and coordinate through Context internally.

```javascript
const TabsContext = createContext(null);
function Tabs({ defaultTab, children }) {
  const [active, setActive] = useState(defaultTab);
  const value = useMemo(() => ({ active, setActive }), [active]);
  return <TabsContext value={value}>{children}</TabsContext>;
}
function TabList({ children }) {
  return <div role="tablist">{children}</div>;
}
function Tab({ id, children }) {
  const { active, setActive } = useContext(TabsContext);
  return (
    <button role="tab" aria-selected={active === id} onClick={() => setActive(id)}>
      {children}
    </button>
  );
}
function TabPanel({ id, children }) {
  const { active } = useContext(TabsContext);
  if (active !== id) return null;
  return <div role="tabpanel">{children}</div>;
}
Tabs.List = TabList;
Tabs.Tab = Tab;
Tabs.Panel = TabPanel;
```

```javascript
function Settings() {
  return (
    <Tabs defaultTab="profile">
      <Tabs.List>
        <Tabs.Tab id="profile">Profile</Tabs.Tab>
        <Tabs.Tab id="billing">Billing</Tabs.Tab>
      </Tabs.List>
      <Tabs.Panel id="profile"><ProfileForm /></Tabs.Panel>
      <Tabs.Panel id="billing"><BillingForm /></Tabs.Panel>
    </Tabs>
  );
}
```

The caller controls the markup and ordering completely, while the shared state stays hidden. Compare a `<Tabs items={[...]} />` API, which would need a new prop for every customisation anyone ever wants.

## Render props

Pass a function that returns markup, when the child needs to supply data to the parent's rendering.

```javascript
function MousePosition({ children }) {
  const [position, setPosition] = useState({ x: 0, y: 0 });
  useEffect(() => {
    function handleMove(event) {
      setPosition({ x: event.clientX, y: event.clientY });
    }
    window.addEventListener('mousemove', handleMove);
    return () => window.removeEventListener('mousemove', handleMove);
  }, []);
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

Custom hooks replaced most uses of this. `useMousePosition()` is simpler. Render props still make sense when the shared thing is markup rather than logic.

## Composition or Context?

**Composition** when the data has a clear owner and a clear destination. It keeps everything explicit and traceable, with no hidden dependencies.

**Context** when the value is genuinely app wide and read from many unrelated places: the theme, the current user, the language.

The mistake is reaching for Context first. Try composition, and if the structure still fights you, then add Context.

## The limit

Composition does not help when a component **deep inside a list** needs a value.

```javascript
function App() {
  const { theme } = useTheme();
  return (
    <ProductGrid>
      {products.map((p) => (
        <ProductCard key={p.id} product={p} theme={theme} />
      ))}
    </ProductGrid>
  );
}
```

If every nested piece needs the theme, you are back to drilling. That is exactly the case Context exists for.

## Quick recap

- Prop drilling passes data through components that do not use it.
- Composition passes the rendered element instead, so the middle never sees the data.
- JSX is a value, so it can be any prop, giving you slots.
- `children` is the most common slot.
- Compound components expose parts and share state internally.
- Render props still suit sharing markup, but hooks replaced most uses.
- Try composition before Context, and use Context for genuinely global values.

<code id="code-content" class="language-javascript">
import { createContext, useContext, useState, useMemo } from 'react';
// PROP DRILLING: Layout and Sidebar do not use `user`, they just carry it
function Drilled({ user }) {
  return &lt;Layout user={user} /&gt;;      // -&gt; Sidebar -&gt; UserPanel
}
// COMPOSITION: pass the rendered ELEMENT, not the data. Layout no longer
// knows `user` exists at all, and becomes genuinely reusable.
function PageLayout({ header, sidebar, children, footer }) {
  return (
    &lt;div className="page"&gt;
      &lt;header&gt;{header}&lt;/header&gt;
      &lt;div className="body"&gt;
        &lt;aside&gt;{sidebar}&lt;/aside&gt;
        &lt;main&gt;{children}&lt;/main&gt;
      &lt;/div&gt;
      &lt;footer&gt;{footer}&lt;/footer&gt;
    &lt;/div&gt;
  );
}
function ProductPage({ product, user }) {
  // Every element is created HERE, where the data is in scope
  return (
    &lt;PageLayout
      header={&lt;Breadcrumbs product={product} /&gt;}
      sidebar={&lt;UserPanel user={user} /&gt;}
      footer={&lt;RelatedProducts ids={product.relatedIds} /&gt;}
    &gt;
      &lt;ProductDetail product={product} /&gt;
    &lt;/PageLayout&gt;
  );
}
// COMPOUND COMPONENTS: expose the parts, hide the shared state.
// The caller controls the markup completely.
const TabsContext = createContext(null);
function Tabs({ defaultTab, children }) {
  const [active, setActive] = useState(defaultTab);
  const value = useMemo(() =&gt; ({ active, setActive }), [active]);
  return &lt;TabsContext value={value}&gt;{children}&lt;/TabsContext&gt;;
}
Tabs.List = function TabList({ children }) {
  return &lt;div role="tablist"&gt;{children}&lt;/div&gt;;
};
Tabs.Tab = function Tab({ id, children }) {
  const { active, setActive } = useContext(TabsContext);
  return (
    &lt;button role="tab" aria-selected={active === id} onClick={() =&gt; setActive(id)}&gt;
      {children}
    &lt;/button&gt;
  );
};
Tabs.Panel = function TabPanel({ id, children }) {
  const { active } = useContext(TabsContext);
  return active === id ? &lt;div role="tabpanel"&gt;{children}&lt;/div&gt; : null;
};
export default function Settings() {
  return (
    &lt;Tabs defaultTab="profile"&gt;
      &lt;Tabs.List&gt;
        &lt;Tabs.Tab id="profile"&gt;Profile&lt;/Tabs.Tab&gt;
        &lt;Tabs.Tab id="billing"&gt;Billing&lt;/Tabs.Tab&gt;
      &lt;/Tabs.List&gt;
      &lt;Tabs.Panel id="profile"&gt;&lt;ProfileForm /&gt;&lt;/Tabs.Panel&gt;
      &lt;Tabs.Panel id="billing"&gt;&lt;BillingForm /&gt;&lt;/Tabs.Panel&gt;
    &lt;/Tabs&gt;
  );
}
// Try COMPOSITION first. Reach for Context only when a value is genuinely
// app wide and read from many unrelated places, or when the components
// that need it are buried inside a list you are mapping over.
</code></pre>
