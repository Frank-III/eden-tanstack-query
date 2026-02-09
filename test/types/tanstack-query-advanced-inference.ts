/**
 * Type inference tests for advanced EdenTQ features.
 * This file should NOT be run - only type-checked with the project's tsconfig.
 * 
 * These tests verify that the exported types have the expected structure.
 * For full type inference tests with actual Elysia routes, see the runtime tests.
 */
import type {
    EdenTQ,
    EdenTQUtils,
    EdenQueryOptions,
    EdenInfiniteQueryOptions,
    EdenMutationOptions,
    QueryKey,
    QueryClient,
    InfiniteData
} from '../../src'
import { expectTypeOf } from 'expect-type'

// ============================================================================
// Test: EdenQueryOptions structure
// ============================================================================
{
    type Options = EdenQueryOptions<{ id: string }, Error>

    expectTypeOf<Options['queryKey']>().toMatchTypeOf<QueryKey>()
    expectTypeOf<Options['queryFn']>().toMatchTypeOf<() => Promise<{ id: string }>>()
    expectTypeOf<Options['enabled']>().toMatchTypeOf<boolean | Function | undefined>()
    expectTypeOf<Options['staleTime']>().toMatchTypeOf<number | 'static' | Function | undefined>()
    expectTypeOf<Options['gcTime']>().toMatchTypeOf<number | undefined>()
}

// ============================================================================
// Test: EdenInfiniteQueryOptions structure
// ============================================================================
{
    type Options = EdenInfiniteQueryOptions<
        { items: string[] },
        Error,
        { items: string[] },
        QueryKey,
        number
    >

    expectTypeOf<Options['queryKey']>().toMatchTypeOf<QueryKey>()
    expectTypeOf<Options['queryFn']>().toBeFunction()
    expectTypeOf<Options['initialPageParam']>().toBeNumber()
    expectTypeOf<Options['getNextPageParam']>().toBeFunction()
    expectTypeOf<Options['getPreviousPageParam']>().toMatchTypeOf<Function | undefined>()
    expectTypeOf<Options['maxPages']>().toMatchTypeOf<number | undefined>()
}

// ============================================================================
// Test: EdenMutationOptions structure
// ============================================================================
{
    type Options = EdenMutationOptions<{ id: string }, Error, { name: string }>

    expectTypeOf<Options['mutationKey']>().toMatchTypeOf<QueryKey>()
    expectTypeOf<Options['mutationFn']>().toMatchTypeOf<(variables: { name: string }) => Promise<{ id: string }>>()
    expectTypeOf<Options['onMutate']>().toMatchTypeOf<Function | undefined>()
    expectTypeOf<Options['onSuccess']>().toMatchTypeOf<Function | undefined>()
    expectTypeOf<Options['onError']>().toMatchTypeOf<Function | undefined>()
    expectTypeOf<Options['onSettled']>().toMatchTypeOf<Function | undefined>()
}

// ============================================================================
// Test: EdenTQ.Config structure
// ============================================================================
{
    type Config = EdenTQ.Config

    expectTypeOf<Config['queryKeyPrefix']>().toMatchTypeOf<QueryKey | undefined>()
}

// ============================================================================
// Test: InfiniteData re-export
// ============================================================================
{
    type Data = InfiniteData<{ items: string[] }, number>

    expectTypeOf<Data['pages']>().toMatchTypeOf<Array<{ items: string[] }>>()
    expectTypeOf<Data['pageParams']>().toMatchTypeOf<number[]>()
}

// ============================================================================
// Test: QueryKey and QueryClient re-exports
// ============================================================================
{
    expectTypeOf<QueryKey>().toMatchTypeOf<readonly unknown[]>()

    const qc: QueryClient = {} as QueryClient
    expectTypeOf(qc.fetchQuery).toBeFunction()
    expectTypeOf(qc.fetchInfiniteQuery).toBeFunction()
    expectTypeOf(qc.invalidateQueries).toBeFunction()
}
