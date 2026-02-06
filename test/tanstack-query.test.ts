import { Elysia, t } from 'elysia'
import { createEdenTQ } from '../src'
import { describe, expect, it, mock, test } from 'bun:test'

const app = new Elysia()
    .get('/', () => 'hello')
    .get('/header-echo', ({ headers }) => headers['x-test'] ?? null)
    .get('/user/:id', ({ params }) => ({ id: params.id, name: 'John' }))
    .post('/user', ({ body }) => ({ id: '1', ...body }), {
        body: t.Object({
            name: t.String(),
            email: t.String()
        })
    })
    .put('/user/:id', ({ params, body }) => ({ id: params.id, ...body }), {
        body: t.Object({
            name: t.String()
        })
    })
    .delete('/user/:id', ({ params }) => ({ deleted: params.id }))
    .get('/posts', ({ query }) => ({ posts: [], filter: query.filter }), {
        query: t.Object({
            filter: t.Optional(t.String())
        })
    })

describe('createEdenTQ', () => {
    const eden = createEdenTQ<typeof app>(app)

    describe('queryKey', () => {
        it('generates query key for simple route', () => {
            const key = eden.get.queryKey({})
            expect(key).toEqual(['eden', 'get', [], null, null])
        })

        it('generates query key with params', () => {
            const key = eden.user({ id: '123' }).get.queryKey({ params: { id: '123' } })
            expect(key).toEqual(['eden', 'get', ['user', '123'], { id: '123' }, null])
        })

        it('generates query key with query params', () => {
            const key = eden.posts.get.queryKey({ query: { filter: 'active' } })
            expect(key).toEqual(['eden', 'get', ['posts'], null, { filter: 'active' }])
        })
    })

    describe('queryOptions', () => {
        it('returns valid query options for GET', async () => {
            const options = eden.get.queryOptions({})

            expect(options.queryKey).toEqual(['eden', 'get', [], null, null])
            expect(typeof options.queryFn).toBe('function')

            const data = await options.queryFn()
            expect(data).toBe('hello')
        })

        it('works with route params', async () => {
            const options = eden.user({ id: '42' }).get.queryOptions({
                params: { id: '42' }
            })

            expect(options.queryKey).toEqual([
                'eden',
                'get',
                ['user', '42'],
                { id: '42' },
                null
            ])

            const data = await options.queryFn()
            expect(data).toEqual({ id: '42', name: 'John' })
        })

        it('works with query params', async () => {
            const options = eden.posts.get.queryOptions({
                query: { filter: 'active' }
            })

            const data = await options.queryFn()
            expect(data).toEqual({ posts: [], filter: 'active' })
        })

        it('accepts overrides', () => {
            const options = eden.get.queryOptions({}, {
                queryKey: ['custom', 'key']
            })

            expect(options.queryKey).toEqual(['custom', 'key'])
        })
    })

    describe('mutationOptions', () => {
        it('returns valid mutation options for POST', async () => {
            const options = eden.user.post.mutationOptions()

            expect(options.mutationKey).toEqual(['eden', 'post', ['user']])
            expect(typeof options.mutationFn).toBe('function')

            const data = await options.mutationFn({
                body: { name: 'Alice', email: 'alice@example.com' }
            })
            expect(data).toEqual({ id: '1', name: 'Alice', email: 'alice@example.com' })
        })

        it('works with PUT and params', async () => {
            const options = eden.user({ id: '99' }).put.mutationOptions()

            const data = await options.mutationFn({
                params: { id: '99' },
                body: { name: 'Updated' }
            })
            expect(data).toEqual({ id: '99', name: 'Updated' })
        })

        it('works with DELETE', async () => {
            const options = eden.user({ id: '55' }).delete.mutationOptions()

            const data = await options.mutationFn({
                params: { id: '55' }
            })
            expect(data).toEqual({ deleted: '55' })
        })
    })

    describe('invalidate', () => {
        it('calls queryClient.invalidateQueries with correct key', async () => {
            const mockInvalidate = mock(() => Promise.resolve())
            const mockQueryClient = {
                invalidateQueries: mockInvalidate
            }

            await eden.user({ id: '123' }).get.invalidate(mockQueryClient, {
                params: { id: '123' }
            })

            expect(mockInvalidate).toHaveBeenCalledWith({
                queryKey: ['eden', 'get', ['user', '123'], { id: '123' }, null],
                exact: false
            })
        })

        it('supports exact invalidation', async () => {
            const mockInvalidate = mock(() => Promise.resolve())
            const mockQueryClient = {
                invalidateQueries: mockInvalidate
            }

            await eden.posts.get.invalidate(mockQueryClient, { query: { filter: 'active' } }, true)

            expect(mockInvalidate).toHaveBeenCalledWith({
                queryKey: ['eden', 'get', ['posts'], null, { filter: 'active' }],
                exact: true
            })
        })

        it('invalidates all queries for a route when no input', async () => {
            const mockInvalidate = mock(() => Promise.resolve())
            const mockQueryClient = {
                invalidateQueries: mockInvalidate
            }

            await eden.posts.get.invalidate(mockQueryClient)

            expect(mockInvalidate).toHaveBeenCalledWith({
                queryKey: ['eden', 'get', ['posts']],
                exact: false
            })
        })
    })

    describe('direct call', () => {
        it('can still call the method directly like treaty', async () => {
            const result = await eden.get({})

            expect(result.data).toBe('hello')
            expect(result.error).toBeNull()
        })

        it('returns error in result for failed requests', async () => {
            const badEden = createEdenTQ<typeof app>('http://localhost:9999')
            const result = await badEden.get({})

            expect(result.data).toBeNull()
            expect(result.error).not.toBeNull()
        })

        it('uses direct call RequestInit options as fetch options', async () => {
            const result = await eden['header-echo'].get({}, {
                headers: {
                    'x-test': 'via-direct-options'
                }
            })

            expect(result.data).toBe('via-direct-options')
            expect(result.error).toBeNull()
        })
    })

    describe('custom queryKeyPrefix', () => {
        it('uses custom prefix', () => {
            const customEden = createEdenTQ<typeof app>('http://localhost:3456', {
                queryKeyPrefix: ['myApp', 'api']
            })

            const key = customEden.get.queryKey({})
            expect(key).toEqual(['myApp', 'api', 'get', [], null, null])
        })
    })
})
