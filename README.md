# eden-tanstack-query

TanStack Query integration for [Elysia Eden](https://github.com/elysiajs/eden) - type-safe queries and mutations with zero boilerplate.

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

### Mutations

```ts
import { createMutation } from '@tanstack/svelte-query'

const mutation = createMutation(() => 
  eden.users.post.mutationOptions()
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

## API

### `createEdenTQ<App>(domain, config?)`

Creates a type-safe Eden client with TanStack Query helpers.

- `domain`: Your API URL or Elysia app instance
- `config.queryKeyPrefix`: Custom prefix for query keys (default: `['eden']`)

### Method Helpers

Each HTTP method (`get`, `post`, `put`, `delete`, `patch`) has:

- `.queryOptions(input, overrides?)` - Returns `{ queryKey, queryFn }`
- `.mutationOptions(overrides?)` - Returns `{ mutationKey, mutationFn }`
- `.queryKey(input?)` - Returns the query key
- `.mutationKey(input?)` - Returns the mutation key
- `.invalidate(queryClient, input?, exact?)` - Invalidates matching queries

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
