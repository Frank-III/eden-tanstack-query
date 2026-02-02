import { Elysia, t } from 'elysia'
import { createEdenTQ } from '../src'
import { QueryClient } from '@tanstack/query-core'
import { describe, expect, it, beforeAll, afterAll, test } from 'bun:test'
import { expectTypeOf } from 'expect-type'

const ShareLinkSchema = t.Object({
    id: t.String(),
    url: t.String(),
    token: t.String(),
    expiresAt: t.String(),
    expiresInDays: t.Number(),
    contact: t.Nullable(t.Object({
        id: t.String(),
        email: t.Nullable(t.String()),
        name: t.String()
    }))
})

const MarketEffortEntrySchema = t.Object({
    name: t.String(),
    type: t.Union([t.Literal('admitted'), t.Literal('surplus')]),
    outcome: t.Union([t.Literal('quoted'), t.Literal('declined')]),
    premium: t.Optional(t.Number()),
    reason: t.Optional(t.String())
})

const app = new Elysia()
    .get('/', () => 'hello')
    .get('/user/:id', ({ params }) => ({
        id: params.id,
        name: 'John',
        email: 'john@example.com'
    }), {
        response: t.Object({
            id: t.String(),
            name: t.String(),
            email: t.String()
        })
    })
    .post('/user', ({ body }) => ({
        id: crypto.randomUUID(),
        ...body
    }), {
        body: t.Object({
            name: t.String(),
            email: t.String()
        }),
        response: t.Object({
            id: t.String(),
            name: t.String(),
            email: t.String()
        })
    })
    .group('/cases/:id', app => app
        .get('/share-links', ({ params }) => ({
            data: [
                {
                    id: 'link-1',
                    url: `https://share.example.com/${params.id}/abc`,
                    token: 'abc123',
                    expiresAt: '2025-02-01T00:00:00Z',
                    expiresInDays: 7,
                    contact: { id: 'contact-1', email: 'john@test.com', name: 'John' }
                }
            ]
        }), {
            response: t.Object({
                data: t.Array(ShareLinkSchema)
            })
        })
        .post('/share-link', ({ params, body }) => ({
            id: 'new-link-id',
            url: `https://share.example.com/${params.id}/xyz`,
            token: 'xyz789',
            expiresAt: '2025-02-01T00:00:00Z',
            expiresInDays: body.expiresInDays ?? 7,
            contact: body.contactId ? { id: body.contactId, email: null, name: 'Contact' } : null
        }), {
            body: t.Object({
                contactId: t.Optional(t.String()),
                expiresInDays: t.Optional(t.Union([t.Literal(1), t.Literal(7), t.Literal(30)]))
            }),
            response: ShareLinkSchema
        })
        .get('/market-effort', ({ params }) => ({
            caseId: params.id,
            markets: [
                { name: 'Carrier A', type: 'admitted' as const, outcome: 'quoted' as const, premium: 50000 }
            ]
        }), {
            response: t.Object({
                caseId: t.String(),
                markets: t.Array(MarketEffortEntrySchema)
            })
        })
        .patch('/market-effort', ({ params, body }) => ({
            caseId: params.id,
            markets: body.markets
        }), {
            body: t.Object({
                markets: t.Array(MarketEffortEntrySchema)
            }),
            response: t.Object({
                caseId: t.String(),
                markets: t.Array(MarketEffortEntrySchema)
            })
        })
    )

let server: ReturnType<typeof app.listen>

beforeAll(() => {
    server = app.listen(3458)
})

afterAll(() => {
    server.stop()
})

describe('TanStack Query Integration', () => {
    const eden = createEdenTQ<typeof app>('http://localhost:3458')

    describe('Works with real QueryClient', () => {
        it('queryOptions works with QueryClient.fetchQuery', async () => {
            const queryClient = new QueryClient()

            const options = eden.user({ id: '42' }).get.queryOptions({
                params: { id: '42' }
            })

            const data = await queryClient.fetchQuery(options)

            expect(data.id).toBe('42')
            expect(data.name).toBe('John')
            expect(data.email).toBe('john@example.com')

            expectTypeOf(data).toMatchTypeOf<{
                id: string
                name: string
                email: string
            }>()
        })

        it('mutationOptions works with QueryClient.executeMutation', async () => {
            const queryClient = new QueryClient()

            const mutationOptions = eden.user.post.mutationOptions()

            const cache = queryClient.getMutationCache()
            const mutation = cache.build(queryClient, mutationOptions)

            const result = await mutation.execute({
                body: { name: 'Alice', email: 'alice@example.com' }
            })

            expect(result.name).toBe('Alice')
            expect(result.email).toBe('alice@example.com')
            expect(result.id).toBeDefined()

            expectTypeOf(result).toMatchTypeOf<{
                id: string
                name: string
                email: string
            }>()
        })

        it('invalidate works with real QueryClient', async () => {
            const queryClient = new QueryClient()
            const caseId = 'case-123'

            const options = eden.cases({ id: caseId })['share-links'].get.queryOptions({
                params: { id: caseId }
            })
            await queryClient.fetchQuery(options)

            expect(queryClient.getQueryData(options.queryKey)).toBeDefined()

            await eden.cases({ id: caseId })['share-links'].get.invalidate(
                queryClient,
                { params: { id: caseId } }
            )

            const state = queryClient.getQueryState(options.queryKey)
            expect(state?.isInvalidated).toBe(true)
        })
    })

    describe('Type safety', () => {
        it('queryOptions returns correct data type', async () => {
            const caseId = 'case-abc'
            const options = eden.cases({ id: caseId })['share-links'].get.queryOptions({
                params: { id: caseId }
            })

            const data = await options.queryFn!()

            expectTypeOf(data).toMatchTypeOf<{
                data: Array<{
                    id: string
                    url: string
                    token: string
                    expiresAt: string
                    expiresInDays: number
                    contact: { id: string; email: string | null; name: string } | null
                }>
            }>()

            expect(data.data[0].contact?.name).toBe('John')
        })

        it('mutationOptions has correct variable types', async () => {
            const caseId = 'case-xyz'
            const options = eden.cases({ id: caseId })['share-link'].post.mutationOptions()

            const result = await options.mutationFn!({
                params: { id: caseId },
                body: { contactId: 'c-1', expiresInDays: 30 }
            })

            expectTypeOf(result).toMatchTypeOf<{
                id: string
                url: string
                token: string
                expiresAt: string
                expiresInDays: number
                contact: { id: string; email: string | null; name: string } | null
            }>()

            expect(result.expiresInDays).toBe(30)
        })

        it('market effort query has union types', async () => {
            const caseId = 'case-market'
            const options = eden.cases({ id: caseId })['market-effort'].get.queryOptions({
                params: { id: caseId }
            })

            const data = await options.queryFn!()

            expectTypeOf(data.markets[0].type).toEqualTypeOf<'admitted' | 'surplus'>()
            expectTypeOf(data.markets[0].outcome).toEqualTypeOf<'quoted' | 'declined'>()
        })

        it('market effort mutation accepts correct body', async () => {
            const caseId = 'case-update'
            const options = eden.cases({ id: caseId })['market-effort'].patch.mutationOptions()

            const result = await options.mutationFn!({
                params: { id: caseId },
                body: {
                    markets: [
                        { name: 'Test', type: 'admitted', outcome: 'quoted', premium: 100 }
                    ]
                }
            })

            expect(result.markets[0].name).toBe('Test')
        })
    })

    describe('Query key consistency', () => {
        it('queryKey matches between queryOptions and invalidate', async () => {
            const queryClient = new QueryClient()
            const caseId = 'case-key-test'

            const options = eden.cases({ id: caseId })['share-links'].get.queryOptions({
                params: { id: caseId }
            })

            const directKey = eden.cases({ id: caseId })['share-links'].get.queryKey({
                params: { id: caseId }
            })

            expect(options.queryKey).toEqual(directKey)

            await queryClient.fetchQuery(options)

            await eden.cases({ id: caseId })['share-links'].get.invalidate(
                queryClient,
                { params: { id: caseId } },
                true
            )

            const state = queryClient.getQueryState(directKey)
            expect(state?.isInvalidated).toBe(true)
        })
    })
})

describe('Usage Examples - Before vs After', () => {
    const eden = createEdenTQ<typeof app>('http://localhost:3458')

    test('Share Links Query - shows reduced boilerplate', async () => {
        const caseId = 'demo-case'

        const options = eden.cases({ id: caseId })['share-links'].get.queryOptions({
            params: { id: caseId }
        })

        expect(options.queryKey).toBeDefined()
        expect(options.queryFn).toBeDefined()

        const data = await options.queryFn!()
        expect(data.data).toBeInstanceOf(Array)
    })

    test('Create Share Link Mutation - type-safe without manual casting', async () => {
        const caseId = 'demo-case'

        const options = eden.cases({ id: caseId })['share-link'].post.mutationOptions()

        const result = await options.mutationFn!({
            params: { id: caseId },
            body: { expiresInDays: 7 }
        })

        expect(result.id).toBeDefined()
        expect(result.url).toContain(caseId)
    })

    test('Invalidation after mutation', async () => {
        const queryClient = new QueryClient()
        const caseId = 'demo-case'

        const queryOptions = eden.cases({ id: caseId })['share-links'].get.queryOptions({
            params: { id: caseId }
        })
        await queryClient.fetchQuery(queryOptions)

        await eden.cases({ id: caseId })['share-links'].get.invalidate(queryClient, {
            params: { id: caseId }
        })

        expect(queryClient.getQueryState(queryOptions.queryKey)?.isInvalidated).toBe(true)
    })
})
