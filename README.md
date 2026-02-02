# eden-tanstack-query

TanStack Query integration for [Elysia Eden](https://github.com/elysiajs/eden) - type-safe queries and mutations with zero boilerplate.

Highlights:

- Auto-generated `queryKey`, `queryOptions`, `mutationOptions`, and cache helpers
- Type-safe data and error inference from your Elysia routes
- Works with any TanStack Query adapter (React, Svelte, Vue, Solid)

## Installation

```bash
bun add eden-tanstack-query @elysiajs/eden @tanstack/query-core
# or
npm install eden-tanstack-query @elysiajs/eden @tanstack/query-core
```

## Usage

```ts
import { createEdenTQ } from 'eden-tanstack-query'
import type { App } from './server' // Your Elysia app type

const eden = createEdenTQ<App>('http://localhost:3000')
```

### Queries

```ts
import { createQuery } from '@tanstack/svelte-query' // or react-query, vue-query, etc.

// Fully type-safe, auto-generated query key
const query = createQuery(() => 
  eden.users({ id: '123' }).get.queryOptions({
    params: { id: '123' }
  })
)

// query.data is typed as your Elysia response type!
```

React example:

```ts
import { useQuery } from '@tanstack/react-query'

const query = useQuery(
  eden.users({ id: '123' }).get.queryOptions({
    params: { id: '123' }
  })
)
```

### Infinite Queries

```ts
import { createInfiniteQuery } from '@tanstack/svelte-query'

const infiniteQuery = createInfiniteQuery(() =>
  eden.posts.get.infiniteQueryOptions(
    { query: { limit: '10' } },
    {
      initialPageParam: 0,
      getNextPageParam: (lastPage) => lastPage.nextCursor,
      // cursorKey: 'cursor' // optional, defaults to 'cursor'
    }
  )
)
```

### Mutations

```ts
import { createMutation } from '@tanstack/svelte-query'

const mutation = createMutation(() => 
  eden.users.post.mutationOptions({
    onSuccess: (data) => {
      console.log('Created user:', data.id)
    }
  })
)

// Type-safe variables
mutation.mutate({
  body: { name: 'Alice', email: 'alice@example.com' }
})
```

### Invalidation

```ts
import { useQueryClient } from '@tanstack/svelte-query'

const queryClient = useQueryClient()

// Invalidate specific query
await eden.users({ id: '123' }).get.invalidate(queryClient, {
  params: { id: '123' }
})

// Invalidate all queries for a route
await eden.users({ id: '123' }).get.invalidate(queryClient)
```

### Utils (Bound QueryClient)

For tRPC-like ergonomics, use `createEdenTQUtils` to bind a QueryClient once:

```ts
import { createEdenTQ, createEdenTQUtils } from 'eden-tanstack-query'

const eden = createEdenTQ<App>('http://localhost:3000')
const utils = createEdenTQUtils(eden, queryClient)

// No need to pass queryClient every time!
await utils.users({ id: '123' }).get.invalidate({ params: { id: '123' } })
await utils.posts.get.prefetch({ query: { limit: '10' } })
await utils.posts.get.cancel()
await utils.posts.get.refetch()

// Cache manipulation
utils.users({ id: '123' }).get.setData({ params: { id: '123' } }, { id: '123', name: 'Updated' })
const cached = utils.users({ id: '123' }).get.getData({ params: { id: '123' } })
```

### Error Handling

`queryFn` and `mutationFn` throw when the Eden response has `error`, so TanStack
Query error states are populated automatically:

```ts
const options = eden.users({ id: '123' }).get.queryOptions({
  params: { id: '123' }
})

try {
  const data = await options.queryFn()
} catch (error) {
  // error is typed from your Elysia response map
}
```

## API

### `createEdenTQ<App>(domain, config?)`

Creates a type-safe Eden client with TanStack Query helpers.

- `domain`: Your API URL or Elysia app instance
- `config.queryKeyPrefix`: Custom prefix for query keys (default: `['eden']`)

### `createEdenTQUtils<App>(eden, queryClient)`

Creates a utils object with a bound QueryClient for tRPC-like ergonomics.

### Method Helpers

Each HTTP method (`get`, `post`, `put`, `delete`, `patch`) has:

| Method | Description |
|--------|-------------|
| `.queryOptions(input, overrides?)` | Returns `{ queryKey, queryFn, ...options }` for `createQuery` |
| `.infiniteQueryOptions(input, opts, overrides?)` | Returns options for `createInfiniteQuery` |
| `.mutationOptions(overrides?)` | Returns `{ mutationKey, mutationFn, ...options }` for `createMutation` |
| `.queryKey(input?)` | Returns the query key |
| `.mutationKey(input?)` | Returns the mutation key |
| `.invalidate(queryClient, input?, exact?)` | Invalidates matching queries |
| `.prefetch(queryClient, input)` | Prefetch a query |
| `.ensureData(queryClient, input)` | Ensure data exists or fetch it |
| `.setData(queryClient, input, updater)` | Manually set cache data |
| `.getData(queryClient, input)` | Read from cache |

### Query Key Shape

Query keys are deterministic and include routing information:

```
[
  ...queryKeyPrefix, // default ['eden']
  method,            // 'get', 'post', ...
  pathTemplate,      // e.g. ['users', ':id']
  params ?? null,
  query ?? null
]
```

### Query Options Overrides

You can pass standard TanStack Query options as overrides:

```ts
eden.posts.get.queryOptions(
  { query: { limit: '10' } },
  {
    staleTime: 5000,
    gcTime: 10000,
    enabled: isReady,
    refetchOnMount: false,
    retry: 3
  }
)
```

### Mutation Options Overrides

```ts
eden.users.post.mutationOptions({
  onMutate: (variables) => {
    // Optimistic update
  },
  onSuccess: (data, variables) => {
    // Invalidate related queries
  },
  onError: (error, variables, context) => {
    // Rollback
  }
})
```

## Before / After

### Before (manual boilerplate)

```ts
export function createUserQuery(userId: string) {
  return createQuery<User>(() => ({
    queryKey: ['users', userId],
    queryFn: async () => {
      const { data, error } = await api.users({ id: userId }).get()
      if (error) throw error
      return data as User // Manual cast!
    },
  }))
}
```

### After (with eden-tanstack-query)

```ts
export function createUserQuery(userId: string) {
  return createQuery(() => 
    eden.users({ id: userId }).get.queryOptions({
      params: { id: userId }
    })
  )
}
// Types are inferred from your Elysia server!
```

## License

MIT
