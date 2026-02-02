/**
 * This file tests that Eden TQ types integrate correctly with TanStack Query.
 * It should NOT be run - only type-checked.
 */
import { Elysia, t } from 'elysia'
import { createEdenTQ } from '../../src'
import { QueryClient } from '@tanstack/query-core'
import { expectTypeOf } from 'expect-type'

// Define a realistic API
const app = new Elysia()
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
        id: '1',
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
    .post('/cases/:id/share-link', ({ params, body }) => ({
        id: 'link-1',
        caseId: params.id,
        expiresInDays: body.expiresInDays ?? 7
    }), {
        body: t.Object({
            contactId: t.Optional(t.String()),
            expiresInDays: t.Optional(t.Union([t.Literal(1), t.Literal(7), t.Literal(30)]))
        }),
        response: t.Object({
            id: t.String(),
            caseId: t.String(),
            expiresInDays: t.Number()
        })
    })

const eden = createEdenTQ<typeof app>('http://localhost:3000')

// ============================================================================
// Test: QueryClient.fetchQuery works with queryOptions
// ============================================================================
async function testFetchQuery() {
    const queryClient = new QueryClient()

    const options = eden.user({ id: '123' }).get.queryOptions({
        params: { id: '123' }
    })

    // This should work and infer the correct type
    const data = await queryClient.fetchQuery(options)

    // Type assertions
    expectTypeOf(data).toHaveProperty('id')
    expectTypeOf(data).toHaveProperty('name')
    expectTypeOf(data).toHaveProperty('email')
    expectTypeOf(data.id).toBeString()
    expectTypeOf(data.name).toBeString()
    expectTypeOf(data.email).toBeString()
}

// ============================================================================
// Test: Mutation with QueryClient works
// ============================================================================
async function testMutation() {
    const queryClient = new QueryClient()

    const mutationOptions = eden.user.post.mutationOptions()

    // Build and execute mutation
    const cache = queryClient.getMutationCache()
    const mutation = cache.build(queryClient, mutationOptions)

    const result = await mutation.execute({
        body: { name: 'Alice', email: 'alice@test.com' }
    })

    expectTypeOf(result).toHaveProperty('id')
    expectTypeOf(result).toHaveProperty('name')
    expectTypeOf(result).toHaveProperty('email')
}

// ============================================================================
// Test: queryOptions has correct structure
// ============================================================================
{
    const options = eden.user({ id: '123' }).get.queryOptions({
        params: { id: '123' }
    })

    // Must have queryKey and queryFn
    expectTypeOf(options).toHaveProperty('queryKey')
    expectTypeOf(options).toHaveProperty('queryFn')

    // queryKey is a readonly array
    expectTypeOf(options.queryKey).toMatchTypeOf<readonly unknown[]>()

    // queryFn is a function that returns a Promise
    expectTypeOf(options.queryFn).toBeFunction()
}

// ============================================================================
// Test: mutationOptions has correct structure
// ============================================================================
{
    const options = eden.user.post.mutationOptions()

    expectTypeOf(options).toHaveProperty('mutationKey')
    expectTypeOf(options).toHaveProperty('mutationFn')

    expectTypeOf(options.mutationKey).toMatchTypeOf<readonly unknown[]>()
    expectTypeOf(options.mutationFn).toBeFunction()
}

// ============================================================================
// Test: Union types are preserved
// ============================================================================
async function testUnionTypes() {
    const queryClient = new QueryClient()

    const options = eden.cases({ id: 'case-1' })['share-link'].post.mutationOptions()

    const cache = queryClient.getMutationCache()
    const mutation = cache.build(queryClient, options)

    const result = await mutation.execute({
        params: { id: 'case-1' },
        body: { expiresInDays: 7 } // Must be 1 | 7 | 30
    })

    expectTypeOf(result.expiresInDays).toBeNumber()
}

// ============================================================================
// Test: Type errors are caught
// ============================================================================
{
    // @ts-expect-error - body must have both name and email
    eden.user.post.mutationOptions().mutationFn({ body: { name: 'test' } })
}

{
    eden.cases({ id: 'x' })['share-link'].post.mutationOptions().mutationFn({
        params: { id: 'x' },
        // @ts-expect-error - expiresInDays must be 1 | 7 | 30
        body: { expiresInDays: 5 }
    })
}
