import type { Elysia } from 'elysia'
import type { QueryKey, QueryClient } from '@tanstack/query-core'
import { treaty, type Treaty } from '@elysiajs/eden/treaty2'
import type { EdenTQ, EdenQueryOptions, EdenMutationOptions } from './types'

const HTTP_METHODS = [
    'get',
    'post',
    'put',
    'delete',
    'patch',
    'options',
    'head'
] as const

type HttpMethod = (typeof HTTP_METHODS)[number]

function isHttpMethod(value: string): value is HttpMethod {
    return HTTP_METHODS.includes(value as HttpMethod)
}

function materializePath(
    paths: string[],
    params?: Record<string, string | number>
): string[] {
    const result: string[] = []

    for (const segment of paths) {
        const match = /^:(.+?)(\?)?$/.exec(segment)
        if (!match) {
            result.push(segment)
            continue
        }

        const paramName = match[1]
        const isOptional = !!match[2]
        const value = params?.[paramName]

        if (value == null) {
            if (isOptional) continue
            throw new Error(`Missing required route parameter: "${paramName}"`)
        }

        result.push(String(value))
    }

    return result
}

function buildQueryKey(
    prefix: QueryKey,
    method: string,
    pathTemplate: string[],
    input?: { params?: unknown; query?: unknown }
): QueryKey {
    return [
        ...prefix,
        method,
        pathTemplate,
        input?.params ?? null,
        input?.query ?? null
    ] as const
}

function callTreaty(
    raw: any,
    segments: string[],
    method: string,
    input?: { body?: unknown; query?: unknown; headers?: unknown; fetch?: RequestInit }
): Promise<Treaty.TreatyResponse<any>> {
    let current = raw

    for (const segment of segments) {
        current = current[segment]
    }

    const options: Record<string, unknown> = {}
    if (input?.query !== undefined) options.query = input.query
    if (input?.headers !== undefined) options.headers = input.headers
    if (input?.fetch !== undefined) Object.assign(options, input.fetch)

    if (method === 'get' || method === 'head') {
        return current[method](Object.keys(options).length > 0 ? options : undefined)
    }

    return current[method](
        input?.body,
        Object.keys(options).length > 0 ? options : undefined
    )
}

async function dataOrThrow<T>(
    promise: Promise<Treaty.TreatyResponse<any>>
): Promise<T> {
    const result = await promise
    if (result.error) throw result.error
    return result.data as T
}

interface ProxyContext {
    raw: any
    prefix: QueryKey
}

function createMethodDecorator(
    ctx: ProxyContext,
    paths: string[],
    method: string
) {
    const pathTemplate = [...paths]

    const fn = (
        input?: { params?: Record<string, string | number>; body?: unknown; query?: unknown; headers?: unknown; fetch?: RequestInit }
    ) => {
        const materializedPath = materializePath(pathTemplate, input?.params)
        return callTreaty(ctx.raw, materializedPath, method, input)
    }

    fn.queryKey = (
        input?: { params?: Record<string, string | number>; query?: unknown }
    ): QueryKey => {
        return buildQueryKey(ctx.prefix, method, pathTemplate, input)
    }

    fn.queryOptions = <TData = unknown>(
        input: { params?: Record<string, string | number>; query?: unknown; headers?: unknown; fetch?: RequestInit },
        overrides?: Partial<EdenQueryOptions<TData>>
    ): EdenQueryOptions<TData> => {
        return {
            queryKey: fn.queryKey(input),
            queryFn: () => {
                const materializedPath = materializePath(pathTemplate, input?.params)
                return dataOrThrow(callTreaty(ctx.raw, materializedPath, method, input))
            },
            ...overrides
        }
    }

    fn.mutationKey = (
        input?: { params?: Record<string, string | number>; query?: unknown }
    ): QueryKey => {
        return buildQueryKey(ctx.prefix, method, pathTemplate, input)
    }

    fn.mutationOptions = <TData = unknown, TVariables = unknown>(
        overrides?: Partial<EdenMutationOptions<TData, unknown, TVariables>>
    ): EdenMutationOptions<TData, unknown, TVariables> => {
        return {
            mutationKey: [...ctx.prefix, method, pathTemplate],
            mutationFn: (variables: TVariables) => {
                const vars = variables as { params?: Record<string, string | number>; body?: unknown; query?: unknown; headers?: unknown; fetch?: RequestInit }
                const materializedPath = materializePath(pathTemplate, vars?.params)
                return dataOrThrow(callTreaty(ctx.raw, materializedPath, method, vars))
            },
            ...overrides
        }
    }

    fn.invalidate = async (
        queryClient: QueryClient,
        input?: { params?: Record<string, string | number>; query?: unknown },
        exact = false
    ): Promise<void> => {
        const queryKey = input
            ? fn.queryKey(input)
            : [...ctx.prefix, method, pathTemplate]
        await queryClient.invalidateQueries({ queryKey, exact })
    }

    return fn
}

function createEdenTQProxy(
    ctx: ProxyContext,
    paths: string[] = []
): any {
    return new Proxy(() => {}, {
        get(_, prop: string): any {
            if (isHttpMethod(prop)) {
                return createMethodDecorator(ctx, paths, prop)
            }

            return createEdenTQProxy(
                ctx,
                prop === 'index' ? paths : [...paths, prop]
            )
        },
        apply(_, __, [body]) {
            if (typeof body === 'object' && body !== null) {
                const paramValue = Object.values(body)[0] as string
                return createEdenTQProxy(ctx, [...paths, paramValue])
            }
            return createEdenTQProxy(ctx, paths)
        }
    })
}

export function createEdenTQ<
    const App extends Elysia<any, any, any, any, any, any, any>
>(
    domain: string | App,
    config: EdenTQ.Config = {}
): EdenTQ.Create<App> {
    const { queryKeyPrefix = ['eden'], ...treatyConfig } = config

    const raw = treaty<App>(domain as any, treatyConfig)

    const ctx: ProxyContext = {
        raw,
        prefix: queryKeyPrefix
    }

    return createEdenTQProxy(ctx) as EdenTQ.Create<App>
}

export type { EdenTQ, EdenQueryOptions, EdenMutationOptions }
export type { QueryKey, QueryClient } from '@tanstack/query-core'
