import { Elysia, t } from 'elysia'
import { createEdenTQ } from '../src'
import { describe, expect, it, mock, test } from 'bun:test'
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
        .group('/share-links/:linkId', app => app
            .delete('/', ({ params }) => ({
                success: true,
                deleted: { id: params.linkId }
            }), {
                response: t.Object({
                    success: t.Boolean(),
                    deleted: t.Object({ id: t.String() })
                })
            })
        )
        .get('/market-effort', ({ params }) => ({
            caseId: params.id,
            markets: [
                { name: 'Carrier A', type: 'admitted' as const, outcome: 'quoted' as const, premium: 50000 },
                { name: 'Carrier B', type: 'surplus' as const, outcome: 'declined' as const, reason: 'Risk too high' }
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

const eden = createEdenTQ<typeof app>(app)

describe('Real-world API patterns', () => {
    describe('Share Links Query', () => {
        it('generates correct queryOptions with type-safe response', async () => {
            const caseId = 'case-123'

            const options = eden.cases({ id: caseId })['share-links'].get.queryOptions({
                params: { id: caseId }
            })

            expect(options.queryKey).toEqual([
                'eden',
                'get',
                ['cases', caseId, 'share-links'],
                { id: caseId },
                null
            ])

            const result = await options.queryFn()

            expect(result.data).toHaveLength(1)
            expect(result.data[0].id).toBe('link-1')
            expect(result.data[0].contact?.name).toBe('John')

            expectTypeOf(result).toMatchTypeOf<{
                data: Array<{
                    id: string
                    url: string
                    token: string
                    expiresAt: string
                    expiresInDays: number
                    contact: { id: string; email: string | null; name: string } | null
                }>
            }>()
        })

        it('supports custom options like staleTime', () => {
            const caseId = 'case-123'

            const options = eden.cases({ id: caseId })['share-links'].get.queryOptions(
                { params: { id: caseId } },
                {
                    staleTime: 10_000,
                    gcTime: 20_000
                }
            )

            expect(options.queryKey).toEqual([
                'eden',
                'get',
                ['cases', caseId, 'share-links'],
                { id: caseId },
                null
            ])
            expect(options.staleTime).toBe(10_000)
            expect(options.gcTime).toBe(20_000)
        })

        it('supports deferred path params when placeholder value is empty', async () => {
            const caseId = 'case-deferred-query'

            const options = eden.cases({ id: '' })['share-links'].get.queryOptions({
                params: { id: caseId }
            })

            expect(options.queryKey).toEqual([
                'eden',
                'get',
                ['cases', ':id', 'share-links'],
                { id: caseId },
                null
            ])

            const result = await options.queryFn()
            expect(result.data[0].url).toContain(`/${caseId}/`)
        })
    })

    describe('Create Share Link Mutation', () => {
        it('generates correct mutationOptions with type-safe variables', async () => {
            const caseId = 'case-456'

            const options = eden.cases({ id: caseId })['share-link'].post.mutationOptions()

            expect(options.mutationKey).toEqual([
                'eden',
                'post',
                ['cases', caseId, 'share-link']
            ])

            const result = await options.mutationFn({
                params: { id: caseId },
                body: {
                    contactId: 'contact-abc',
                    expiresInDays: 30
                }
            })

            expect(result.id).toBe('new-link-id')
            expect(result.expiresInDays).toBe(30)
            expect(result.contact?.id).toBe('contact-abc')

            expectTypeOf(result).toMatchTypeOf<{
                id: string
                url: string
                token: string
                expiresAt: string
                expiresInDays: number
                contact: { id: string; email: string | null; name: string } | null
            }>()
        })

        it('uses mutation params when placeholder value is empty', async () => {
            const caseId = 'case-deferred-mutation'

            const options = eden.cases({ id: '' })['share-link'].post.mutationOptions()
            const result = await options.mutationFn({
                params: { id: caseId },
                body: { expiresInDays: 7 }
            })

            expect(result.url).toContain(`/${caseId}/`)
            expect(result.expiresInDays).toBe(7)
        })
    })

    describe('Revoke Share Link Mutation', () => {
        it('handles nested params correctly', async () => {
            const caseId = 'case-789'
            const linkId = 'link-to-delete'

            const options = eden
                .cases({ id: caseId })
                ['share-links']({ linkId })
                .index
                .delete
                .mutationOptions()

            const result = await options.mutationFn({
                params: { id: caseId, linkId }
            })

            expect(result.success).toBe(true)
            expect(result.deleted.id).toBe(linkId)

            expectTypeOf(result).toMatchTypeOf<{
                success: boolean
                deleted: { id: string }
            }>()
        })
    })

    describe('Market Effort Query', () => {
        it('returns type-safe market effort data', async () => {
            const caseId = 'case-market'

            const options = eden.cases({ id: caseId })['market-effort'].get.queryOptions({
                params: { id: caseId }
            })

            const result = await options.queryFn()

            expect(result.caseId).toBe(caseId)
            expect(result.markets).toHaveLength(2)
            expect(result.markets[0].type).toBe('admitted')
            expect(result.markets[1].outcome).toBe('declined')

            expectTypeOf(result.markets[0]).toMatchTypeOf<{
                name: string
                type: 'admitted' | 'surplus'
                outcome: 'quoted' | 'declined'
                premium?: number
                reason?: string
            }>()
        })
    })

    describe('Update Market Effort Mutation', () => {
        it('handles patch with array body correctly', async () => {
            const caseId = 'case-update'

            const options = eden.cases({ id: caseId })['market-effort'].patch.mutationOptions()

            const result = await options.mutationFn({
                params: { id: caseId },
                body: {
                    markets: [
                        { name: 'New Carrier', type: 'admitted', outcome: 'quoted', premium: 75000 }
                    ]
                }
            })

            expect(result.caseId).toBe(caseId)
            expect(result.markets[0].name).toBe('New Carrier')
        })
    })

    describe('Invalidation patterns', () => {
        it('can invalidate share links for a case', async () => {
            const caseId = 'case-inv'
            const mockInvalidate = mock(() => Promise.resolve())
            const mockQueryClient = { invalidateQueries: mockInvalidate }

            await eden.cases({ id: caseId })['share-links'].get.invalidate(
                mockQueryClient,
                { params: { id: caseId } }
            )

            expect(mockInvalidate).toHaveBeenCalledWith({
                queryKey: ['eden', 'get', ['cases', caseId, 'share-links'], { id: caseId }, null],
                exact: false
            })
        })

        it('can invalidate all share links queries', async () => {
            const caseId = 'any'
            const mockInvalidate = mock(() => Promise.resolve())
            const mockQueryClient = { invalidateQueries: mockInvalidate }

            await eden.cases({ id: caseId })['share-links'].get.invalidate(mockQueryClient)

            expect(mockInvalidate).toHaveBeenCalledWith({
                queryKey: ['eden', 'get', ['cases', caseId, 'share-links']],
                exact: false
            })
        })
    })
})

describe('Comparison: Before vs After', () => {
    it('shows the difference in boilerplate', async () => {
        const caseId = 'demo-case'

        const options = eden.cases({ id: caseId })['share-links'].get.queryOptions({
            params: { id: caseId }
        })

        expect(options.queryKey).toBeDefined()
        expect(options.queryFn).toBeDefined()
    })
})
