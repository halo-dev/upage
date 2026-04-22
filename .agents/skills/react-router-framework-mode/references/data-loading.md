---
title: Data Loading
description: Server loaders, client loaders, streaming, caching patterns
tags: [loader, clientLoader, data, streaming, Suspense, defer]
---

# Data Loading

Data is loaded using `loader` (server) and `clientLoader` (browser) functions.

## Server Loader

Runs on the server during SSR and on server during client navigation:

```tsx
export async function loader({ params, request }: Route.LoaderArgs) {
  const product = await db.getProduct(params.id);
  return product;
}

export default function Product({ loaderData }: Route.ComponentProps) {
  return <h1>{loaderData.name}</h1>;
}
```

### LoaderArgs

- `params` - URL parameters from dynamic segments
- `request` - The Fetch Request object
- `context` - App context passed from server entry

## Client Loader

Runs in the browser. Useful for:

- Skipping the server hop (calling APIs directly)
- Combining server and client data
- Client-side caching

```tsx
export async function clientLoader({ params }: Route.ClientLoaderArgs) {
  const res = await fetch(`/api/products/${params.id}`);
  return res.json();
}
```

### Combining Server and Client Loaders

```tsx
export async function loader({ params }: Route.LoaderArgs) {
  return db.getProduct(params.id);
}

export async function clientLoader({ serverLoader }: Route.ClientLoaderArgs) {
  // Get server data
  const serverData = await serverLoader();

  // Add client-only data
  const preferences = localStorage.getItem("prefs");

  return { ...serverData, preferences: JSON.parse(preferences || "{}") };
}
```

### Hydration with Client Loader

Force `clientLoader` to run during initial page hydration:

```tsx
export async function clientLoader({ serverLoader }: Route.ClientLoaderArgs) {
  const cached = getFromCache();
  if (cached) return cached;

  const data = await serverLoader();
  setInCache(data);
  return data;
}

// This enables the clientLoader to run on hydration
clientLoader.hydrate = true;

// Show fallback while clientLoader runs
export function HydrateFallback() {
  return <ProductSkeleton />;
}
```

## Returning Responses

Loaders can return plain objects or Response objects:

```tsx
export async function loader({ params }: Route.LoaderArgs) {
  const product = await db.getProduct(params.id);

  if (!product) {
    throw new Response("Not Found", { status: 404 });
  }

  return product;
}
```

## Throwing Redirects

Redirect from loaders using `redirect`:

```tsx
import { redirect } from "react-router";

export async function loader({ request }: Route.LoaderArgs) {
  const user = await getUser(request);

  if (!user) {
    throw redirect("/login");
  }

  return user;
}
```

## Using Request

Access headers, URL, and signal from the request:

```tsx
export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const query = url.searchParams.get("q");

  // Use abort signal for cancellation
  const results = await search(query, { signal: request.signal });

  return results;
}
```

## Parallel Data Loading

React Router loads data for all matched routes in parallel. Parent and child loaders run simultaneously, not sequentially.

## Streaming with defer (Advanced)

Stream slow data while rendering fast data immediately:

```tsx
import { defer, Await } from "react-router";
import { Suspense } from "react";

export async function loader({ params }: Route.LoaderArgs) {
  return {
    product: await db.getProduct(params.id), // Await immediately
    reviews: db.getReviews(params.id), // Don't await - stream later
  };
}

export default function Product({ loaderData }: Route.ComponentProps) {
  return (
    <div>
      <h1>{loaderData.product.name}</h1>

      <Suspense fallback={<ReviewsSkeleton />}>
        <Await resolve={loaderData.reviews}>
          {(reviews) => <Reviews items={reviews} />}
        </Await>
      </Suspense>
    </div>
  );
}
```
