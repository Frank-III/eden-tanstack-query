import { Elysia, t } from 'elysia'
import { createEdenTQ, createEdenTQUtils } from '../src'
import { QueryClient } from '@tanstack/query-core'
import { describe, expect, it, mock, test } from 'bun:test'

const posts = Array.from({ length: 50 }, (_, i) => ({
    id: `post-${i + 1}`,
    title: `Post ${i + 1}`,
    content: `Content of post ${i + 1}`
}))

const app = new Elysia()
    .get('/', () => 'hello')
    .get('/user/:id', ({ params }) => ({ id: params.id, name: 'John' }))
    .post('/user', ({ body }) => ({ id: '1', ...body }), {
        body: t.Object({
            name: t.String(),
            email: t.String()
        })
    })
    .get('/posts', ({ query }) => {
        const cursor = query.cursor ? parseInt(query.cursor) : 0
        const limit = query.limit ? parseInt(query.limit) : 10
        const slice = posts.slice(cursor, cursor + limit)
        const nextCursor = cursor + limit < posts.length ? cursor + limit : null

        return {
            items: slice,
            nextCursor
        }
    }, {
        query: t.Object({
            cursor: t.Optional(t.String()),
            limit: t.Optional(t.String())
        }),
        response: t.Object({
            items: t.Array(t.Object({
                id: t.String(),
                title: t.String(),
                content: t.String()
            })),
            nextCursor: t.Nullable(t.Number())
        })
    })
    .get('/comments', ({ query }) => {
        const page = query.page ? parseInt(query.page) : 1
        return {
            data: [{ id: `c-${page}`, text: `Comment page ${page}` }],
            page,
            hasMore: page < 5
        }
    }, {
        query: t.Object({
            page: t.Optional(t.String())
        })
})

const eden = createEdenTQ<typeof app>(app)

describe('Infinite Query', () => {
    it('generates infiniteQueryOptions with cursor pagination', async () => {
        const options = eden.posts.get.infiniteQueryOptions(
            { query: { limit: '5' } },
            {
                initialPageParam: 0,
                getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined
            }
        )

        expect(options.queryKey).toBeDefined()
        expect(options.queryFn).toBeDefined()
        expect(options.initialPageParam).toBe(0)
        expect(typeof options.getNextPageParam).toBe('function')
    })

    it('queryFn receives pageParam and injects into query', async () => {
        const options = eden.posts.get.infiniteQueryOptions(
            { query: { limit: '5' } },
            {
                initialPageParam: 0,
                getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined
            }
        )

        const firstPage = await options.queryFn({
            queryKey: options.queryKey,
            pageParam: 0,
            direction: 'forward',
            meta: undefined,
            signal: new AbortController().signal
        })

        expect(firstPage.items).toHaveLength(5)
        expect(firstPage.items[0].id).toBe('post-1')
        expect(firstPage.nextCursor).toBe(5)

        const secondPage = await options.queryFn({
            queryKey: options.queryKey,
            pageParam: 5,
            direction: 'forward',
            meta: undefined,
            signal: new AbortController().signal
        })

        expect(secondPage.items).toHaveLength(5)
        expect(secondPage.items[0].id).toBe('post-6')
    })

    it('works with fetchInfiniteQuery on QueryClient', async () => {
        const queryClient = new QueryClient()

        const options = eden.posts.get.infiniteQueryOptions(
            { query: { limit: '10' } },
            {
                initialPageParam: 0,
                getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined
            }
        )

        const data = await queryClient.fetchInfiniteQuery(options)

        expect(data.pages).toHaveLength(1)
        expect(data.pages[0].items).toHaveLength(10)
        expect(data.pageParams).toEqual([0])
    })

    it('supports custom cursorKey', async () => {
        const options = eden.comments.get.infiniteQueryOptions(
            { query: {} },
            {
                initialPageParam: 1,
                cursorKey: 'page',
                getNextPageParam: (lastPage) => lastPage.hasMore ? lastPage.page + 1 : undefined
            }
        )

        const firstPage = await options.queryFn({
            queryKey: options.queryKey,
            pageParam: 1,
            direction: 'forward',
            meta: undefined,
            signal: new AbortController().signal
        })

        expect(firstPage.page).toBe(1)
        expect(firstPage.hasMore).toBe(true)

        const secondPage = await options.queryFn({
            queryKey: options.queryKey,
            pageParam: 2,
            direction: 'forward',
            meta: undefined,
            signal: new AbortController().signal
        })

        expect(secondPage.page).toBe(2)
    })

    it('accepts overrides for infinite query options', () => {
        const options = eden.posts.get.infiniteQueryOptions(
            { query: { limit: '10' } },
            {
                initialPageParam: 0,
                getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined
            },
            {
                staleTime: 5000,
                gcTime: 10000,
                maxPages: 3
            }
        )

        expect(options.staleTime).toBe(5000)
        expect(options.gcTime).toBe(10000)
        expect(options.maxPages).toBe(3)
    })
})

describe('EdenTQ Utils', () => {
    it('creates utils with bound QueryClient', () => {
        const queryClient = new QueryClient()
        const utils = createEdenTQUtils(eden, queryClient)

        expect(utils).toBeDefined()
        expect(utils.posts.get.queryKey).toBeDefined()
        expect(utils.posts.get.invalidate).toBeDefined()
    })

    it('invalidate without passing queryClient', async () => {
        const queryClient = new QueryClient()
        const utils = createEdenTQUtils(eden, queryClient)

        const options = utils.posts.get.queryOptions({ query: { limit: '5' } })
        await queryClient.fetchQuery(options)

        expect(queryClient.getQueryData(options.queryKey)).toBeDefined()

        await utils.posts.get.invalidate({ query: { limit: '5' } })

        const state = queryClient.getQueryState(options.queryKey)
        expect(state?.isInvalidated).toBe(true)
    })

    it('prefetch works', async () => {
        const queryClient = new QueryClient()
        const utils = createEdenTQUtils(eden, queryClient)

        await utils.posts.get.prefetch({ query: { limit: '5' } })

        const key = utils.posts.get.queryKey({ query: { limit: '5' } })
        expect(queryClient.getQueryData(key)).toBeDefined()
    })

    it('setData and getData work', () => {
        const queryClient = new QueryClient()
        const utils = createEdenTQUtils(eden, queryClient)

        const input = { params: { id: '123' } }

        utils.user({ id: '123' }).get.setData(input, { id: '123', name: 'Updated' })

        const data = utils.user({ id: '123' }).get.getData(input)
        expect(data).toEqual({ id: '123', name: 'Updated' })
    })

    it('ensureData fetches if not cached', async () => {
        const queryClient = new QueryClient()
        const utils = createEdenTQUtils(eden, queryClient)

        const data = await utils.user({ id: '42' }).get.ensureData({
            params: { id: '42' }
        })

        expect(data).toEqual({ id: '42', name: 'John' })
    })

    it('supports deferred params in utils route calls', async () => {
        const queryClient = new QueryClient()
        const utils = createEdenTQUtils(eden, queryClient)

        const data = await utils.user({ id: '' }).get.ensureData({
            params: { id: 'deferred-42' }
        })

        expect(data).toEqual({ id: 'deferred-42', name: 'John' })
    })

    it('returns undefined for symbol property access on utils proxy', () => {
        const queryClient = new QueryClient()
        const utils = createEdenTQUtils(eden, queryClient)

        expect((utils as any)[Symbol.toStringTag]).toBeUndefined()
    })

    it('cancel cancels in-flight queries', async () => {
        const queryClient = new QueryClient()
        const utils = createEdenTQUtils(eden, queryClient)

        await utils.posts.get.cancel({ query: { limit: '5' } })
    })

    it('refetch refetches queries', async () => {
        const queryClient = new QueryClient()
        const utils = createEdenTQUtils(eden, queryClient)

        await utils.posts.get.prefetch({ query: { limit: '5' } })
        await utils.posts.get.refetch({ query: { limit: '5' } })

        const key = utils.posts.get.queryKey({ query: { limit: '5' } })
        const state = queryClient.getQueryState(key)
        expect(state?.dataUpdateCount).toBeGreaterThanOrEqual(1)
    })
})

describe('Prefetch and Cache helpers on EdenTQ', () => {
    it('prefetch works directly on eden', async () => {
        const queryClient = new QueryClient()

        await eden.posts.get.prefetch(queryClient, { query: { limit: '5' } })

        const key = eden.posts.get.queryKey({ query: { limit: '5' } })
        expect(queryClient.getQueryData(key)).toBeDefined()
    })

    it('ensureData works directly on eden', async () => {
        const queryClient = new QueryClient()

        const data = await eden.user({ id: '99' }).get.ensureData(queryClient, {
            params: { id: '99' }
        })

        expect(data).toEqual({ id: '99', name: 'John' })
    })

    it('setData and getData work directly on eden', () => {
        const queryClient = new QueryClient()

        eden.user({ id: '77' }).get.setData(queryClient, { params: { id: '77' } }, {
            id: '77',
            name: 'Manual'
        })

        const data = eden.user({ id: '77' }).get.getData(queryClient, { params: { id: '77' } })
        expect(data).toEqual({ id: '77', name: 'Manual' })
    })
})

describe('Query Options extensions', () => {
    it('queryOptions accepts extended options', () => {
        const options = eden.get.queryOptions({}, {
            staleTime: 1000,
            gcTime: 5000,
            enabled: false,
            refetchOnMount: false,
            retry: 3
        })

        expect(options.staleTime).toBe(1000)
        expect(options.gcTime).toBe(5000)
        expect(options.enabled).toBe(false)
        expect(options.refetchOnMount).toBe(false)
        expect(options.retry).toBe(3)
    })

    it('mutation options accepts callbacks', () => {
        const onMutate = mock(() => {})
        const onSuccess = mock(() => {})

        const options = eden.user.post.mutationOptions({
            onMutate,
            onSuccess
        })

        expect(options.onMutate).toBe(onMutate)
        expect(options.onSuccess).toBe(onSuccess)
    })
})

describe('Error handling', () => {
    it('queryFn throws on API error, making error available to TanStack Query', async () => {
        const badEden = createEdenTQ<typeof app>('http://localhost:9999')
        const queryClient = new QueryClient({
            defaultOptions: {
                queries: { retry: false }
            }
        })

        const options = badEden.get.queryOptions({})

        await expect(queryClient.fetchQuery(options)).rejects.toThrow()
    })

    it('queryFn throws the actual error from treaty response', async () => {
        const badEden = createEdenTQ<typeof app>('http://localhost:9999')

        const options = badEden.get.queryOptions({})

        try {
            await options.queryFn()
            expect.unreachable('Should have thrown')
        } catch (error) {
            expect(error).toBeDefined()
            expect(error).not.toBeNull()
        }
    })

    it('mutationFn throws on API error', async () => {
        const badEden = createEdenTQ<typeof app>('http://localhost:9999')

        const options = badEden.user.post.mutationOptions()

        await expect(
            options.mutationFn({ body: { name: 'Test', email: 'test@test.com' } })
        ).rejects.toThrow()
    })

    it('QueryClient captures error in query state', async () => {
        const badEden = createEdenTQ<typeof app>('http://localhost:9999')
        const queryClient = new QueryClient({
            defaultOptions: {
                queries: { retry: false }
            }
        })

        const options = badEden.get.queryOptions({})

        try {
            await queryClient.fetchQuery(options)
        } catch {
            // Expected
        }

        const state = queryClient.getQueryState(options.queryKey)
        expect(state?.error).toBeDefined()
        expect(state?.status).toBe('error')
    })
})
