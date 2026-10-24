---
publishDate: 2026-05-14T09:41
title: 'React Router: Navigation, Loaders and Actions'
slug: react-router-navigation-and-hooks
metadescription: Load data before a route renders, submit forms through the router, and use the hooks that report navigation state.
updateDate: 2026-09-05T09:41
author: ['bishal-biswas']
level: 2
tags: ['routing', 'react-router', 'data']
course: react
---

## The render then fetch waterfall

The pattern from the data fetching topic has a hidden cost.

```javascript
function ProductDetail() {
  const { id } = useParams();
  const [product, setProduct] = useState(null);
  useEffect(() => {
    fetchProduct(id).then(setProduct);
  }, [id]);
  if (!product) return <Spinner />;
  return <h1>{product.name}</h1>;
}
```

The sequence is: navigate, render, mount, run the effect, fetch, render again. The user sees a spinner every time, and nested components each start their own request only after their parent has rendered.

Loaders remove that. The router fetches **while navigating**, before the component renders at all.

## Loaders

```javascript
const router = createBrowserRouter([
  {
    path: '/products/:id',
    element: <ProductDetail />,
    loader: async ({ params }) => {
      const response = await fetch(`/api/products/${params.id}`);
      if (!response.ok) {
        throw new Response('Not found', { status: 404 });
      }
      return response.json();
    }
  }
]);
```

```javascript
import { useLoaderData } from 'react-router-dom';
function ProductDetail() {
  const product = useLoaderData();
  return <h1>{product.name}</h1>;
}
```

The component has **no loading state at all**. By the time it renders, the data is there.

The loader receives `params` and `request`, so you can read the URL and query string:

```javascript
loader: async ({ params, request }) => {
  const url = new URL(request.url);
  const page = url.searchParams.get('page') ?? '1';
  return fetchProducts(params.category, page);
}
```

Note `throw new Response(...)` for failures. The router catches it and renders the route's `errorElement`.

## Reporting navigation state

Because the router waits for the loader, navigation is no longer instant. Tell the user.

```javascript
import { useNavigation } from 'react-router-dom';
function RootLayout() {
  const navigation = useNavigation();
  const isNavigating = navigation.state !== 'idle';
  return (
    <div>
      <Header />
      {isNavigating && <ProgressBar />}
      <main style={{ opacity: isNavigating ? 0.6 : 1 }}>
        <Outlet />
      </main>
    </div>
  );
}
```

`navigation.state` is `'idle'`, `'loading'` or `'submitting'`. One indicator in the layout covers every route, so no page needs its own spinner.

This is the same principle as `isPending` in transitions: keep the old page visible and dim it, rather than blanking the screen.

## Actions

The write side of the same idea.

```javascript
{
  path: '/products/new',
  element: <NewProduct />,
  action: async ({ request }) => {
    const formData = await request.formData();
    const product = await createProduct({
      name: formData.get('name'),
      price: Number(formData.get('price'))
    });
    return redirect(`/products/${product.id}`);
  }
}
```

```javascript
import { Form, useNavigation } from 'react-router-dom';
function NewProduct() {
  const navigation = useNavigation();
  const isSubmitting = navigation.state === 'submitting';
  return (
    <Form method="post">
      <input name="name" />
      <input name="price" type="number" />
      <button disabled={isSubmitting}>
        {isSubmitting ? 'Saving...' : 'Create'}
      </button>
    </Form>
  );
}
```

The router's `<Form>` submits to the route's action instead of the server. After the action, **every loader on the page re-runs automatically**, so the interface reflects the new data without you invalidating a cache by hand.

That automatic revalidation is the single biggest reason to use router actions.

Returning validation errors instead of redirecting:

```javascript
action: async ({ request }) => {
  const formData = await request.formData();
  const name = formData.get('name');
  if (!name?.trim()) {
    return { errors: { name: 'A name is required' } };
  }
  await createProduct({ name });
  return redirect('/products');
}
```

```javascript
import { useActionData } from 'react-router-dom';
function NewProduct() {
  const actionData = useActionData();
  return (
    <Form method="post">
      <input name="name" />
      {actionData?.errors?.name && <p>{actionData.errors.name}</p>}
    </Form>
  );
}
```

## Submitting without navigating

`useFetcher` runs a loader or action without changing the URL. Perfect for likes, deletes and inline edits.

```javascript
import { useFetcher } from 'react-router-dom';
function DeleteButton({ productId }) {
  const fetcher = useFetcher();
  const isDeleting = fetcher.state !== 'idle';
  return (
    <fetcher.Form method="post" action={`/products/${productId}/delete`}>
      <button disabled={isDeleting}>
        {isDeleting ? 'Deleting...' : 'Delete'}
      </button>
    </fetcher.Form>
  );
}
```

Loaders still revalidate afterwards, so the list updates itself. The URL never changes and the page never scrolls.

Fetchers also make optimistic updates straightforward, because `fetcher.formData` holds what is being submitted:

```javascript
function TodoItem({ todo }) {
  const fetcher = useFetcher();
  const isDone = fetcher.formData
    ? fetcher.formData.get('done') === 'true'
    : todo.done;
  return (
    <fetcher.Form method="post">
      <input type="hidden" name="done" value={String(!isDone)} />
      <button>{isDone ? 'Done' : 'Not done'}</button>
    </fetcher.Form>
  );
}
```

## The navigation hooks

```javascript
const location = useLocation();
const navigate = useNavigate();
const params = useParams();
const [searchParams, setSearchParams] = useSearchParams();
const navigation = useNavigation();
const data = useLoaderData();
const actionData = useActionData();
const fetcher = useFetcher();
```

`useLocation` is worth a note. It re-renders on every navigation, which makes it useful for scroll restoration and analytics:

```javascript
function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}
```

Browsers restore scroll on back and forward, but a client side router does not always, so pages can open half way down. Adding this component inside the layout fixes it.

## Loaders or a data library?

Both solve the waterfall. They differ in emphasis.

**Router loaders** tie data to the URL, revalidate automatically after actions, and work without any client cache. Best when your data maps cleanly onto routes.

**TanStack Query** caches across routes, dedupes requests, refetches on focus, and handles polling. Best when the same data appears in many places, or updates frequently.

They can be combined, with a loader priming the query cache. Start with one.

## Quick recap

- Loaders fetch during navigation, so components render with data already present.
- Throw a `Response` from a loader to trigger the route's error element.
- `useNavigation` reports loading and submitting for the whole app.
- The router's `<Form>` posts to the route action and revalidates loaders automatically.
- Return an object from an action for validation errors, read with `useActionData`.
- `useFetcher` submits without navigating, which suits likes and deletes.
- Add a scroll to top component, since client routing does not always restore scroll.

<code id="code-content" class="language-javascript">
import {
  createBrowserRouter, Form, Outlet, redirect,
  useLoaderData, useActionData, useNavigation, useFetcher, useLocation
} from 'react-router-dom';
// A LOADER runs while navigating, BEFORE the component renders. The
// component then has no loading state at all.
export const router = createBrowserRouter([
  {
    path: '/products/:id',
    element: &lt;ProductDetail /&gt;,
    errorElement: &lt;ProductError /&gt;,
    loader: async ({ params, request }) =&gt; {
      const url = new URL(request.url);
      const response = await fetch('/api/products/' + params.id);
      // Throwing a Response sends this to the route's errorElement
      if (!response.ok) throw new Response('Not found', { status: 404 });
      return response.json();
    },
    // An ACTION handles writes. Afterwards every loader on the page
    // re-runs automatically, so the UI updates with no cache to manage.
    action: async ({ request, params }) =&gt; {
      const formData = await request.formData();
      const name = formData.get('name');
      if (!name?.trim()) return { errors: { name: 'A name is required' } };
      await updateProduct(params.id, { name });
      return redirect('/products/' + params.id);
    }
  }
]);
function ProductDetail() {
  const product = useLoaderData();       // already here, no spinner
  const actionData = useActionData();    // validation errors, if any
  const navigation = useNavigation();
  const isSubmitting = navigation.state === 'submitting';
  return (
    &lt;div&gt;
      &lt;h1&gt;{product.name}&lt;/h1&gt;
      &lt;Form method="post"&gt;
        &lt;input name="name" defaultValue={product.name} /&gt;
        {actionData?.errors?.name &amp;&amp; &lt;p&gt;{actionData.errors.name}&lt;/p&gt;}
        &lt;button disabled={isSubmitting}&gt;
          {isSubmitting ? 'Saving...' : 'Save'}
        &lt;/button&gt;
      &lt;/Form&gt;
    &lt;/div&gt;
  );
}
// ONE navigation indicator in the layout covers every route
function RootLayout() {
  const navigation = useNavigation();
  const isNavigating = navigation.state !== 'idle';
  return (
    &lt;div&gt;
      &lt;ScrollToTop /&gt;
      {isNavigating &amp;&amp; &lt;div className="progress-bar" /&gt;}
      {/* Dim the old page rather than blanking it */}
      &lt;main style={{ opacity: isNavigating ? 0.6 : 1 }}&gt;
        &lt;Outlet /&gt;
      &lt;/main&gt;
    &lt;/div&gt;
  );
}
// useFetcher submits WITHOUT navigating. Ideal for likes and deletes.
// fetcher.formData holds what is in flight, which makes optimistic
// updates easy.
function ToggleButton({ todo }) {
  const fetcher = useFetcher();
  const isDone = fetcher.formData
    ? fetcher.formData.get('done') === 'true'
    : todo.done;
  return (
    &lt;fetcher.Form method="post" action={'/todos/' + todo.id}&gt;
      &lt;input type="hidden" name="done" value={String(!isDone)} /&gt;
      &lt;button&gt;{isDone ? 'Done' : 'Not done'}&lt;/button&gt;
    &lt;/fetcher.Form&gt;
  );
}
// Client routing does not always restore scroll, so pages can open half
// way down. This fixes it.
function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() =&gt; { window.scrollTo(0, 0); }, [pathname]);
  return null;
}
</code></pre>
