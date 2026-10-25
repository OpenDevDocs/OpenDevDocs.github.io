---
publishDate: 2026-05-04T09:10
title: Props, Children and Default Values
slug: props-and-children
metadescription: Pass data into components, set sensible defaults, forward extra props, and use children to build flexible wrappers.
updateDate: 2026-09-05T09:10
author: ['bishal-biswas']
level: 1
tags: ['props', 'components']
course: react
---

## Passing data in

Props are how a parent gives data to a child.

```javascript
function Welcome(props) {
  return <h1>Hello, {props.name}!</h1>;
}
function App() {
  return <Welcome name="Asha" />;
}
```

`props` is always an object, and every attribute you write becomes a key on it.

## Destructure them

Almost nobody writes `props.name` in real code.

```javascript
function Welcome({ name }) {
  return <h1>Hello, {name}!</h1>;
}
```

Cleaner, and the parameter list documents exactly what the component needs.

## Passing values other than strings

```javascript
function App() {
  const user = { name: 'Asha', age: 28 };
  return (
    <Profile
      name="Asha"
      age={28}
      isAdmin={true}
      isActive
      tags={['react', 'js']}
      user={user}
      onSave={() => console.log('saved')}
    />
  );
}
```

Quotes give you a string. Braces give you a JavaScript value. `isActive` on its own means `true`.

Note `age={28}` versus `age="28"`. The first is a number, the second is a string, and `age + 1` would give `29` or `281` respectively.

## Default values

```javascript
function Button({ label = 'Click me', type = 'button', size = 'md' }) {
  return <button type={type} className={`btn btn-${size}`}>{label}</button>;
}
```

Defaults apply only when the prop is `undefined`. Passing `null` or `0` overrides them.

The old `Button.defaultProps` was removed for function components in React 19. Use parameter defaults.

## Props are read only

```javascript
function Bad({ count }) {
  count = count + 1;
  return <p>{count}</p>;
}
```

Never reassign or mutate a prop. If a value needs to change, it belongs in state, which is the next major topic.

Data flows **down**. A child cannot change what its parent gave it.

## Passing functions down

Since a child cannot change props, the parent passes a function instead.

```javascript
function DeleteButton({ onDelete, label }) {
  return <button onClick={onDelete}>{label}</button>;
}
function TodoItem({ todo, onDelete }) {
  return (
    <li>
      {todo.text}
      <DeleteButton label="Delete" onDelete={() => onDelete(todo.id)} />
    </li>
  );
}
```

The convention is to name these props `onSomething`, and the handlers inside `handleSomething`.

## `children`

Anything between the opening and closing tags arrives as a special prop called `children`.

```javascript
function Card({ children }) {
  return <div className="card">{children}</div>;
}
function App() {
  return (
    <Card>
      <h2>Title</h2>
      <p>Some text</p>
    </Card>
  );
}
```

This is the single most useful pattern in React. The `Card` decides the shell, and the caller decides the contents. No prop for the title, no prop for the body, no guessing what people will need.

Compare the alternative:

```javascript
function RigidCard({ title, body, footer, image, badge }) {
  return <div className="card">...</div>;
}
```

Every new requirement means another prop. `children` never runs out.

## Combining children with props

```javascript
function Modal({ title, isOpen, onClose, children }) {
  if (!isOpen) return null;
  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <header>
          <h2>{title}</h2>
          <button onClick={onClose}>Close</button>
        </header>
        <div className="body">{children}</div>
      </div>
    </div>
  );
}
```

Fixed structure from the component, flexible content from the caller.

## Multiple slots

When you need more than one hole to fill, pass JSX as ordinary props.

```javascript
function Layout({ sidebar, content, footer }) {
  return (
    <div className="layout">
      <aside>{sidebar}</aside>
      <main>{content}</main>
      <footer>{footer}</footer>
    </div>
  );
}
function App() {
  return (
    <Layout
      sidebar={<Nav />}
      content={<Article />}
      footer={<Copyright />}
    />
  );
}
```

JSX is just a value, so it can be a prop like anything else.

## Forwarding the rest

```javascript
function Input({ label, ...rest }) {
  return (
    <label>
      {label}
      <input {...rest} />
    </label>
  );
}
function App() {
  return (
    <Input
      label="Email"
      type="email"
      placeholder="you@example.com"
      required
      maxLength={100}
    />
  );
}
```

`...rest` gathers everything the component does not handle itself, and `{...rest}` spreads it onto the real element. Your wrapper now supports every input attribute without listing any of them.

Put the spread first if you want your own values to win:

```javascript
<input {...rest} className="my-input" />
<input className="my-input" {...rest} />
```

The first forces your class. The second lets the caller override it.

## Checking props

There is no built in type checking any more. `PropTypes` was removed from React in version 19.

Your options are TypeScript, which is what most projects use, or simply being careful. A default plus a clear name goes a long way:

```javascript
function Rating({ value = 0, max = 5 }) {
  const safe = Math.min(Math.max(value, 0), max);
  return <p>{safe} out of {max}</p>;
}
```

## Quick recap

- Props are a read only object passed from parent to child.
- Destructure them in the parameter list, with `=` for defaults.
- Braces pass real JavaScript values, quotes pass strings.
- Pass functions down so children can tell the parent what happened.
- `children` is anything between the tags, and it is the most flexible pattern in React.
- JSX can be passed as any prop, which gives you multiple slots.
- `...rest` forwards unknown props onto the underlying element.
- `PropTypes` is gone in React 19, so use TypeScript or careful defaults.

<code id="code-content" class="language-javascript">
// Destructure props, with defaults for anything optional
function Button({ label = 'Click me', size = 'md', onClick, ...rest }) {
  // ...rest forwards every other attribute onto the real element, so this
  // wrapper supports type, disabled, aria-label and the rest for free
  return (
    &lt;button className={'btn btn-' + size} onClick={onClick} {...rest}&gt;
      {label}
    &lt;/button&gt;
  );
}
// children is anything between the opening and closing tags. The component
// owns the shell, the caller owns the contents.
function Card({ title, children }) {
  return (
    &lt;div className="card"&gt;
      {title &amp;&amp; &lt;h2&gt;{title}&lt;/h2&gt;}
      &lt;div className="card-body"&gt;{children}&lt;/div&gt;
    &lt;/div&gt;
  );
}
// JSX is just a value, so it can be passed as any prop. That gives you
// as many slots as you need.
function Layout({ sidebar, content, footer }) {
  return (
    &lt;div className="layout"&gt;
      &lt;aside&gt;{sidebar}&lt;/aside&gt;
      &lt;main&gt;{content}&lt;/main&gt;
      &lt;footer&gt;{footer}&lt;/footer&gt;
    &lt;/div&gt;
  );
}
// A child cannot change its props, so the parent passes a function down.
// Convention: the prop is onSomething, the handler is handleSomething.
function TodoItem({ todo, onDelete }) {
  return (
    &lt;li&gt;
      {todo.text}
      &lt;Button label="Delete" onClick={() =&gt; onDelete(todo.id)} /&gt;
    &lt;/li&gt;
  );
}
export default function App() {
  const todos = [{ id: 1, text: 'Learn props' }, { id: 2, text: 'Build a card' }];
  function handleDelete(id) {
    console.log('deleting', id);
  }
  return (
    &lt;Layout
      sidebar={&lt;nav&gt;Navigation&lt;/nav&gt;}
      footer={&lt;small&gt;2026&lt;/small&gt;}
      content={
        &lt;Card title="My todos"&gt;
          &lt;ul&gt;
            {todos.map((todo) =&gt; (
              &lt;TodoItem key={todo.id} todo={todo} onDelete={handleDelete} /&gt;
            ))}
          &lt;/ul&gt;
          &lt;Button label="Add" size="lg" disabled aria-label="Add a todo" /&gt;
        &lt;/Card&gt;
      }
    /&gt;
  );
}
</code></pre>
