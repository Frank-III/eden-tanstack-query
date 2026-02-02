/**
 * Type tests for ExtractData and ExtractError fallback behavior.
 * When Res doesn't match Record<number, unknown> properly, these should
 * return unknown instead of never to avoid breaking consumer type inference.
 *
 * This file should NOT be run - only type-checked.
 */
import { Elysia, t } from 'elysia'
import { createEdenTQ } from '../../src'
import { QueryClient } from '@tanstack/query-core'
import { expectTypeOf } from 'expect-type'

// ============================================================================
// Test: Normal case - properly typed response works correctly
// ============================================================================
{
    const app = new Elysia()
        .get('/users', () => [{ id: '1', name: 'John' }], {
            response: t.Array(t.Object({
                id: t.String(),
                name: t.String()
            }))
        })
        .get('/user/:id', ({ params }) => ({ id: params.id, name: 'John' }), {
            response: t.Object({
                id: t.String(),
                name: t.String()
            })
        })

    const eden = createEdenTQ<typeof app>('http://localhost:3000')

    const usersOptions = eden.users.get.queryOptions({})
    const userOptions = eden.user({ id: '1' }).get.queryOptions({ params: { id: '1' } })

    // Data types should be correctly inferred, NOT never
    type UsersData = Awaited<ReturnType<typeof usersOptions.queryFn>>
    type UserData = Awaited<ReturnType<typeof userOptions.queryFn>>

    expectTypeOf<UsersData>().toMatchTypeOf<Array<{ id: string; name: string }>>()
    expectTypeOf<UserData>().toMatchTypeOf<{ id: string; name: string }>()

    // Verify it's not never
    expectTypeOf<UsersData>().not.toBeNever()
    expectTypeOf<UserData>().not.toBeNever()
}

// ============================================================================
// Test: Minimal route without explicit response type
// ============================================================================
{
    const app = new Elysia()
        .get('/hello', () => 'world')
        .get('/number', () => 42)
        .get('/object', () => ({ foo: 'bar' }))

    const eden = createEdenTQ<typeof app>('http://localhost:3000')

    const helloOpts = eden.hello.get.queryOptions({})
    const numberOpts = eden.number.get.queryOptions({})
    const objectOpts = eden.object.get.queryOptions({})

    type HelloData = Awaited<ReturnType<typeof helloOpts.queryFn>>
    type NumberData = Awaited<ReturnType<typeof numberOpts.queryFn>>
    type ObjectData = Awaited<ReturnType<typeof objectOpts.queryFn>>

    // These should NOT be never - either inferred type or unknown fallback
    expectTypeOf<HelloData>().not.toBeNever()
    expectTypeOf<NumberData>().not.toBeNever()
    expectTypeOf<ObjectData>().not.toBeNever()
}

// ============================================================================
// Test: Complex nested routes maintain type safety
// ============================================================================
{
    const app = new Elysia()
        .group('/api', app => app
            .group('/v1', app => app
                .get('/users', () => ({ users: [{ id: '1' }] }), {
                    response: t.Object({
                        users: t.Array(t.Object({ id: t.String() }))
                    })
                })
            )
        )

    const eden = createEdenTQ<typeof app>('http://localhost:3000')
    const opts = eden.api.v1.users.get.queryOptions({})

    type Data = Awaited<ReturnType<typeof opts.queryFn>>

    expectTypeOf<Data>().not.toBeNever()
    expectTypeOf<Data>().toMatchTypeOf<{ users: Array<{ id: string }> }>()
}

// ============================================================================
// Test: Routes with params don't break type extraction
// ============================================================================
{
    const app = new Elysia()
        .get('/orgs/:orgId/users/:userId', ({ params }) => ({
            orgId: params.orgId,
            userId: params.userId,
            name: 'John'
        }), {
            response: t.Object({
                orgId: t.String(),
                userId: t.String(),
                name: t.String()
            })
        })

    const eden = createEdenTQ<typeof app>('http://localhost:3000')
    const opts = eden.orgs({ orgId: 'o1' }).users({ userId: 'u1' }).get.queryOptions({
        params: { orgId: 'o1', userId: 'u1' }
    })

    type Data = Awaited<ReturnType<typeof opts.queryFn>>

    expectTypeOf<Data>().not.toBeNever()
    expectTypeOf<Data>().toMatchTypeOf<{ orgId: string; userId: string; name: string }>()
}

// ============================================================================
// Test: Error types also don't become never
// ============================================================================
{
    const app = new Elysia()
        .get('/might-fail', () => {
            if (Math.random() > 0.5) {
                throw new Error('oops')
            }
            return { ok: true }
        }, {
            response: {
                200: t.Object({ ok: t.Boolean() }),
                500: t.Object({ error: t.String() })
            }
        })

    const eden = createEdenTQ<typeof app>('http://localhost:3000')
    const opts = eden['might-fail'].get.queryOptions({})

    type Data = Awaited<ReturnType<typeof opts.queryFn>>

    // Data should be the success type
    expectTypeOf<Data>().not.toBeNever()
}

// ============================================================================
// Test: QueryClient integration doesn't produce never
// ============================================================================
async function testQueryClientIntegration() {
    const app = new Elysia()
        .get('/data', () => ({ value: 123 }), {
            response: t.Object({ value: t.Number() })
        })

    const eden = createEdenTQ<typeof app>('http://localhost:3000')
    const queryClient = new QueryClient()

    const opts = eden.data.get.queryOptions({})
    const data = await queryClient.fetchQuery(opts)

    // Result should be typed, not never
    expectTypeOf(data).not.toBeNever()
    expectTypeOf(data).toHaveProperty('value')
    expectTypeOf(data.value).toBeNumber()
}

// ============================================================================
// Test: Mutation types don't become never
// ============================================================================
{
    const app = new Elysia()
        .post('/create', ({ body }) => ({
            id: '1',
            name: body.name
        }), {
            body: t.Object({ name: t.String() }),
            response: t.Object({
                id: t.String(),
                name: t.String()
            })
        })

    const eden = createEdenTQ<typeof app>('http://localhost:3000')
    const mutationOpts = eden.create.post.mutationOptions()

    type MutationResult = Awaited<ReturnType<typeof mutationOpts.mutationFn>>

    expectTypeOf<MutationResult>().not.toBeNever()
    expectTypeOf<MutationResult>().toMatchTypeOf<{ id: string; name: string }>()
}
