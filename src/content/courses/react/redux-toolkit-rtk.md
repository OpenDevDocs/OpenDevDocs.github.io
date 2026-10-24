---
publishDate: 2026-05-19T09:54
title: Redux Toolkit and RTK Query
slug: redux-toolkit-rtk
metadescription: Manage global state with Redux Toolkit's slices and store, and fetch server data with RTK Query.
updateDate: 2026-09-05T09:54
author: ['bishal-biswas']
level: 3
tags: ['state', 'redux']
course: react
---

## Do you need Redux?

Honestly, probably not. Most applications are fine with `useState`, Context and a data library.

Redux earns its place when:

- Many distant components read and write the same state.
- You need time travel debugging or a full action log.
- The update logic is complex and benefits from being centralised and testable.
- The team already knows it.

If you are reaching for Redux because "real apps use Redux", stop and try Context or Zustand first.

That said, Redux is everywhere in existing codebases, so it is worth knowing.

## Redux Toolkit, not plain Redux

Old Redux required action types, action creators, reducers and immutable updates by hand. It was famously verbose.

**Redux Toolkit** is now the official way, and it removes most of that. If a tutorial shows you `switch` statements over string constants, it predates 2019.

```bash
npm install @reduxjs/toolkit react-redux
```

## A slice

A slice bundles the state, the reducers and the actions for one feature.

```javascript
import { createSlice } from '@reduxjs/toolkit';
const cartSlice = createSlice({
  name: 'cart',
  initialState: {
    items: [],
    isOpen: false
  },
  reducers: {
    itemAdded(state, action) {
      const existing = state.items.find((i) => i.id === action.payload.id);
      if (existing) {
        existing.quantity += 1;
      } else {
        state.items.push({ ...action.payload, quantity: 1 });
      }
    },
    itemRemoved(state, action) {
      state.items = state.items.filter((i) => i.id !== action.payload);
    },
    cartCleared(state) {
      state.items = [];
    }
  }
});
export const { itemAdded, itemRemoved, cartCleared } = cartSlice.actions;
export default cartSlice.reducer;
```

**That code mutates state, and it is correct.** Redux Toolkit uses Immer, which records your mutations and produces a new immutable object. You get readable code and immutable updates.

This only works inside `createSlice`. Outside it, the usual no mutation rule applies.

Action creators are generated for you, so `itemAdded({ id: 1 })` produces `{ type: 'cart/itemAdded', payload: { id: 1 } }`.

## The store

```javascript
import { configureStore } from '@reduxjs/toolkit';
import cartReducer from './cartSlice.js';
import userReducer from './userSlice.js';
export const store = configureStore({
  reducer: {
    cart: cartReducer,
    user: userReducer
  }
});
```

`configureStore` sets up the DevTools, thunk middleware and development checks for accidental mutation automatically.

```javascript
import { Provider } from 'react-redux';
import { store } from './store.js';
function App() {
  return (
    <Provider store={store}>
      <Shop />
    </Provider>
  );
}
```

## Using it

```javascript
import { useSelector, useDispatch } from 'react-redux';
import { itemAdded, itemRemoved } from './cartSlice.js';
function CartSummary() {
  const items = useSelector((state) => state.cart.items);
  const total = useSelector((state) =>
    state.cart.items.reduce((sum, i) => sum + i.price * i.quantity, 0)
  );
  const dispatch = useDispatch();
  return (
    <div>
      <p>{items.length} items, total {total}</p>
      <button onClick={() => dispatch(itemRemoved(items[0]?.id))}>
        Remove first
      </button>
    </div>
  );
}
```

`useSelector` subscribes to a slice of state and re-renders only when that slice changes.

**Select the narrowest thing you need.**

```javascript
const state = useSelector((state) => state);
const count = useSelector((state) => state.cart.items.length);
```

The first re-renders on every change anywhere. The second only when the count changes.

And beware selectors returning new objects:

```javascript
const { items, isOpen } = useSelector((state) => ({
  items: state.cart.items,
  isOpen: state.cart.isOpen
}));
```

That creates a new object every time, so it always looks different. Use two selectors, or `useSelector` with a shallow equality function.

## Async with thunks

```javascript
import { createAsyncThunk } from '@reduxjs/toolkit';
export const fetchUser = createAsyncThunk(
  'user/fetch',
  async (userId) => {
    const response = await fetch(`/api/users/${userId}`);
    if (!response.ok) throw new Error('Failed');
    return response.json();
  }
);
const userSlice = createSlice({
  name: 'user',
  initialState: { data: null, status: 'idle', error: null },
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchUser.pending, (state) => {
        state.status = 'loading';
      })
      .addCase(fetchUser.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.data = action.payload;
      })
      .addCase(fetchUser.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.error.message;
      });
  }
});
```

That is a lot of ceremony for one fetch. Which is exactly why RTK Query exists.

## RTK Query

Data fetching with caching, deduplication and invalidation, built on Redux.

```javascript
import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
export const api = createApi({
  reducerPath: 'api',
  baseQuery: fetchBaseQuery({ baseUrl: '/api' }),
  tagTypes: ['Product'],
  endpoints: (builder) => ({
    getProducts: builder.query({
      query: () => 'products',
      providesTags: ['Product']
    }),
    getProduct: builder.query({
      query: (id) => `products/${id}`,
      providesTags: (result, error, id) => [{ type: 'Product', id }]
    }),
    addProduct: builder.mutation({
      query: (body) => ({ url: 'products', method: 'POST', body }),
      invalidatesTags: ['Product']
    })
  })
});
export const { useGetProductsQuery, useGetProductQuery, useAddProductMutation } = api;
```

```javascript
function ProductList() {
  const { data, isLoading, error } = useGetProductsQuery();
  const [addProduct, { isLoading: isAdding }] = useAddProductMutation();
  if (isLoading) return <Spinner />;
  if (error) return <p>Failed to load.</p>;
  return (
    <div>
      <ul>{data.map((p) => <li key={p.id}>{p.name}</li>)}</ul>
      <button onClick={() => addProduct({ name: 'New' })} disabled={isAdding}>
        Add
      </button>
    </div>
  );
}
```

The hooks are generated from your endpoint definitions. Adding a product invalidates the `Product` tag, so the list refetches automatically.

**Do not put server data in slices.** Use RTK Query for anything that came from an API, and slices for genuine client state such as a theme, a wizard step or an open modal.

## The alternatives

**Zustand** does global state in a fraction of the code, with no provider.

**TanStack Query** does server data and is more widely used than RTK Query outside Redux projects.

**Context plus useReducer** covers a surprising amount without any dependency.

Redux Toolkit is a solid choice, especially on a team that knows it. It is rarely the only choice.

## Quick recap

- Use Redux Toolkit, never plain Redux.
- A slice bundles state, reducers and generated actions.
- Mutating inside `createSlice` is safe, because Immer handles it.
- `configureStore` wires up DevTools and middleware for you.
- Select the narrowest value, and avoid selectors returning new objects.
- Thunks handle async, but RTK Query handles it far better.
- Keep server data in RTK Query and client state in slices.
- Consider Zustand or TanStack Query before reaching for Redux.

<code id="code-content" class="language-javascript">
import { createSlice, configureStore } from '@reduxjs/toolkit';
import { useSelector, useDispatch } from 'react-redux';
// A SLICE bundles state, reducers and auto generated action creators.
// The code below MUTATES state, and that is correct: Immer records the
// mutations and produces a new immutable object. This only applies
// inside createSlice.
const cartSlice = createSlice({
  name: 'cart',
  initialState: { items: [], isOpen: false },
  reducers: {
    itemAdded(state, action) {
      const existing = state.items.find((i) =&gt; i.id === action.payload.id);
      if (existing) existing.quantity += 1;
      else state.items.push({ ...action.payload, quantity: 1 });
    },
    itemRemoved(state, action) {
      state.items = state.items.filter((i) =&gt; i.id !== action.payload);
    },
    cartCleared(state) {
      state.items = [];
    }
  }
});
export const { itemAdded, itemRemoved, cartCleared } = cartSlice.actions;
// configureStore adds DevTools, thunks and mutation checks automatically
export const store = configureStore({
  reducer: { cart: cartSlice.reducer }
});
function CartSummary() {
  // SELECT THE NARROWEST THING YOU NEED. Selecting the whole state
  // re-renders on every change anywhere in the app.
  const itemCount = useSelector((state) =&gt; state.cart.items.length);
  const total = useSelector((state) =&gt;
    state.cart.items.reduce((sum, i) =&gt; sum + i.price * i.quantity, 0)
  );
  const dispatch = useDispatch();
  // AVOID a selector that builds a new object, because it always looks
  // different and re-renders every time:
  //   useSelector((s) =&gt; ({ items: s.cart.items, isOpen: s.cart.isOpen }))
  return (
    &lt;div&gt;
      &lt;p&gt;{itemCount} items, total Rs {total}&lt;/p&gt;
      &lt;button onClick={() =&gt; dispatch(cartCleared())}&gt;Clear cart&lt;/button&gt;
    &lt;/div&gt;
  );
}
// RTK QUERY generates hooks with caching, deduplication and automatic
// invalidation. Use it for SERVER data, and slices only for client state.
// import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
// export const api = createApi({
//   reducerPath: 'api',
//   baseQuery: fetchBaseQuery({ baseUrl: '/api' }),
//   tagTypes: ['Product'],
//   endpoints: (builder) =&gt; ({
//     getProducts: builder.query({
//       query: () =&gt; 'products',
//       providesTags: ['Product']
//     }),
//     addProduct: builder.mutation({
//       query: (body) =&gt; ({ url: 'products', method: 'POST', body }),
//       invalidatesTags: ['Product']     the list refetches by itself
//     })
//   })
// });
// export const { useGetProductsQuery, useAddProductMutation } = api;
// function ProductList() {
//   const { data, isLoading, error } = useGetProductsQuery();
//   const [addProduct, { isLoading: isAdding }] = useAddProductMutation();
//   ...
// }
</code></pre>
