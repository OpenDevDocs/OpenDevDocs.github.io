---
publishDate: 2026-05-24T10:10
title: TypeScript with React
slug: typescript-with-react
metadescription: Type props, state, hooks, events and children properly, and learn the patterns that make components safe to refactor.
updateDate: 2026-09-05T10:10
author: ['bishal-biswas']
level: 3
tags: ['typescript', 'tooling']
course: react
---

## Why bother

```javascript
<UserCard user={user} onSave={handleSave} />
```

What shape is `user`? Does `onSave` take an argument? Does it return a promise? You have to open the component to find out, and nothing stops you getting it wrong.

With types, the editor tells you, and a mistake fails at build time rather than in front of a user.

The bigger win is refactoring. Rename a field on a type and every place that breaks lights up immediately.

## Typing props

```typescript
type ButtonProps = {
  label: string;
  onClick: () => void;
  variant?: 'primary' | 'secondary';
  disabled?: boolean;
};
function Button({ label, onClick, variant = 'primary', disabled }: ButtonProps) {
  return (
    <button onClick={onClick} disabled={disabled} className={`btn-${variant}`}>
      {label}
    </button>
  );
}
```

`?` marks a prop optional. The union type on `variant` means the editor autocompletes the two valid values and rejects anything else.

Note there is **no `React.FC`**:

```typescript
const Button: React.FC<ButtonProps> = ({ label }) => {};
function Button({ label }: ButtonProps) {}
```

`React.FC` used to add an implicit `children` prop, made generics awkward, and offered nothing in return. It is no longer recommended.

## Children

```typescript
type CardProps = {
  title: string;
  children: React.ReactNode;
};
function Card({ title, children }: CardProps) {
  return (
    <div>
      <h2>{title}</h2>
      {children}
    </div>
  );
}
```

`React.ReactNode` covers everything renderable: elements, strings, numbers, arrays, `null` and `undefined`.

Use `React.ReactElement` only when you specifically need an element and not a string.

## Extending element props

```typescript
type ButtonProps = React.ComponentProps<'button'> & {
  variant?: 'primary' | 'secondary';
};
function Button({ variant = 'primary', className, ...rest }: ButtonProps) {
  return <button className={`btn-${variant} ${className ?? ''}`} {...rest} />;
}
```

Your button now accepts every real button attribute, correctly typed, without listing any of them.

To replace a prop rather than add one:

```typescript
type LinkProps = Omit<React.ComponentProps<'a'>, 'href'> & {
  href: string;
  external?: boolean;
};
```

## Events

```typescript
function Form() {
  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
  }
  function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
    console.log(event.target.value);
  }
  function handleClick(event: React.MouseEvent<HTMLButtonElement>) {}
  function handleKey(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter') {}
  }
  return <form onSubmit={handleSubmit}>...</form>;
}
```

Inline handlers are inferred, so you rarely need these:

```typescript
<input onChange={(event) => setValue(event.target.value)} />
```

## Hooks

`useState` usually infers correctly:

```typescript
const [count, setCount] = useState(0);
const [name, setName] = useState('');
```

Be explicit when the initial value does not tell the whole story:

```typescript
const [user, setUser] = useState<User | null>(null);
const [items, setItems] = useState<Item[]>([]);
```

Without the annotation, `user` would be typed `null` and `items` as `never[]`.

For refs:

```typescript
const inputRef = useRef<HTMLInputElement>(null);
const timerRef = useRef<number | undefined>(undefined);
inputRef.current?.focus();
```

The optional chaining matters, since `current` is `null` before mount.

For reducers:

```typescript
type State = { count: number; status: 'idle' | 'loading' };
type Action = { type: 'increment' } | { type: 'reset' } | { type: 'set'; value: number };
function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'increment':
      return { ...state, count: state.count + 1 };
    case 'set':
      return { ...state, count: action.value };
    case 'reset':
      return { count: 0, status: 'idle' };
  }
}
```

A **discriminated union** for actions is the pattern worth learning. TypeScript narrows by `type`, so `action.value` is available in the `set` case and nowhere else. Miss a case and it complains.

## Context

```typescript
type ThemeContextValue = {
  theme: 'light' | 'dark';
  toggle: () => void;
};
const ThemeContext = createContext<ThemeContextValue | null>(null);
export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === null) {
    throw new Error('useTheme must be used inside a ThemeProvider');
  }
  return context;
}
```

The `null` default plus the throw is what makes `useTheme()` return a non nullable value, so consumers do not need optional chaining everywhere.

## Generic components

```typescript
type ListProps<T> = {
  items: T[];
  renderItem: (item: T) => React.ReactNode;
  getKey: (item: T) => string;
};
function List<T>({ items, renderItem, getKey }: ListProps<T>) {
  return <ul>{items.map((item) => <li key={getKey(item)}>{renderItem(item)}</li>)}</ul>;
}
```

```typescript
<List
  items={users}
  getKey={(user) => user.id}
  renderItem={(user) => <span>{user.name}</span>}
/>
```

`user` is typed automatically inside both callbacks, because `T` was inferred from `items`.

## Do not reach for `any`

```typescript
function process(data: any) {
  return data.whatever.you.like;
}
```

`any` switches checking off completely. Use `unknown` when you genuinely do not know, which forces you to check:

```typescript
function process(data: unknown) {
  if (typeof data === 'object' && data !== null && 'name' in data) {
    console.log(data.name);
  }
}
```

Better still, validate with a schema, as covered in the Zod topic.

## Useful utilities

```typescript
type PartialUser = Partial<User>;
type RequiredUser = Required<User>;
type UserPreview = Pick<User, 'id' | 'name'>;
type UserWithoutId = Omit<User, 'id'>;
type UsersById = Record<string, User>;
type Theme = 'light' | 'dark';
type ButtonVariant = React.ComponentProps<typeof Button>['variant'];
```

That last one extracts a prop type from an existing component, which saves duplicating a union.

## Quick recap

- Type props with a plain type or interface, not `React.FC`.
- `React.ReactNode` is the right type for children.
- `React.ComponentProps<'button'>` inherits every real element prop.
- Annotate `useState` when the initial value is `null` or an empty array.
- Use a discriminated union for reducer actions.
- A `null` context default plus a throwing hook removes optional chaining.
- Generic components infer item types from the array you pass.
- Prefer `unknown` over `any`, and validate at boundaries.

<code id="code-content" class="language-typescript">
import { useState, useRef, useReducer, createContext, useContext } from 'react';
// PROPS: a plain type, not React.FC. Optional props use ?, and a union
// makes the editor autocomplete the valid values.
type ButtonProps = React.ComponentProps&lt;'button'&gt; &amp; {
  variant?: 'primary' | 'secondary';
};
// Inheriting ComponentProps means every real button attribute works,
// correctly typed, without listing a single one
export function Button({ variant = 'primary', className, ...rest }: ButtonProps) {
  return &lt;button className={'btn-' + variant} {...rest} /&gt;;
}
// CHILDREN are React.ReactNode: elements, strings, numbers, null, arrays
type CardProps = { title: string; children: React.ReactNode };
export function Card({ title, children }: CardProps) {
  return &lt;div&gt;&lt;h2&gt;{title}&lt;/h2&gt;{children}&lt;/div&gt;;
}
// HOOKS: annotate when the initial value does not tell the whole story.
// Without these, user would be typed null and items as never[].
type User = { id: string; name: string };
function Profile() {
  const [user, setUser] = useState&lt;User | null&gt;(null);
  const [items, setItems] = useState&lt;User[]&gt;([]);
  const [count, setCount] = useState(0);          // inferred, fine as is
  const inputRef = useRef&lt;HTMLInputElement&gt;(null);
  // current is null before mount, so optional chain it
  inputRef.current?.focus();
  return &lt;input ref={inputRef} /&gt;;
}
// REDUCER ACTIONS as a discriminated union. TypeScript narrows by
// `type`, so action.value exists only in the 'set' case, and a missing
// case is an error.
type State = { count: number; status: 'idle' | 'loading' };
type Action =
  | { type: 'increment' }
  | { type: 'reset' }
  | { type: 'set'; value: number };
function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'increment': return { ...state, count: state.count + 1 };
    case 'set':       return { ...state, count: action.value };
    case 'reset':     return { count: 0, status: 'idle' };
  }
}
// CONTEXT: the null default plus a throwing hook is what lets consumers
// use the value without optional chaining everywhere
type ThemeValue = { theme: 'light' | 'dark'; toggle: () =&gt; void };
const ThemeContext = createContext&lt;ThemeValue | null&gt;(null);
export function useTheme(): ThemeValue {
  const context = useContext(ThemeContext);
  if (context === null) throw new Error('Missing ThemeProvider');
  return context;
}
// GENERIC COMPONENTS: T is inferred from items, so both callbacks are
// typed automatically at the call site
type ListProps&lt;T&gt; = {
  items: T[];
  getKey: (item: T) =&gt; string;
  renderItem: (item: T) =&gt; React.ReactNode;
};
export function List&lt;T&gt;({ items, getKey, renderItem }: ListProps&lt;T&gt;) {
  return &lt;ul&gt;{items.map((i) =&gt; &lt;li key={getKey(i)}&gt;{renderItem(i)}&lt;/li&gt;)}&lt;/ul&gt;;
}
// Prefer unknown over any. any switches checking off entirely.
function process(data: unknown) {
  if (typeof data === 'object' &amp;&amp; data !== null &amp;&amp; 'name' in data) {
    console.log(data.name);
  }
}
</code></pre>
