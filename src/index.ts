import type { Elysia } from 'elysia'
import type { QueryKey, QueryClient, QueryFunctionContext } from '@tanstack/query-core'
import { treaty, type Treaty } from '@elysiajs/eden/treaty2'
import type {
    EdenTQ,
    EdenTQUtils,
    EdenQueryOptions,
    EdenInfiniteQueryOptions,
    EdenMutationOptions
} from './types'

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

function withContextSignal(
    fetch: RequestInit | undefined,
    signal: AbortSignal | undefined
): RequestInit | undefined {
    if (!signal || fetch?.signal) return fetch
    return {
        ...(fetch ?? {}),
        signal
    }
}

function resolvePathSegmentFromCallArg(body: unknown): string | undefined {
    if (typeof body !== 'object' || body === null) return undefined

    const entries = Object.entries(body as Record<string, unknown>)
    if (entries.length === 0) return undefined

    const [paramName, paramValue] = entries[0]

    // Keep dynamic placeholder when call-site intentionally passes an empty value.
    if (paramValue === '' || paramValue == null) {
        return `:${paramName}`
    }

    return String(paramValue)
}

interface ProxyContext {
    raw: any
    prefix: QueryKey
}

interface MethodDecoratorInput {
    params?: Record<string, string | number>
    body?: unknown
    query?: unknown
    headers?: unknown
    fetch?: RequestInit
}

interface InfiniteQueryOpts<TData, TPageParam> {
    initialPageParam: TPageParam
    getNextPageParam: (lastPage: TData, allPages: TData[], lastPageParam: TPageParam, allPageParams: TPageParam[]) => TPageParam | undefined | null
    getPreviousPageParam?: (firstPage: TData, allPages: TData[], firstPageParam: TPageParam, allPageParams: TPageParam[]) => TPageParam | undefined | null
    cursorKey?: string
}

function createMethodDecorator(
    ctx: ProxyContext,
    paths: string[],
    method: string
) {
    const pathTemplate = [...paths]

    const fn = (input?: MethodDecoratorInput, options?: RequestInit) => {
        const mergedInput = options
            ? {
                  ...(input ?? {}),
                  fetch: {
                      ...(input?.fetch ?? {}),
                      ...options
                  }
              }
            : input

        const materializedPath = materializePath(pathTemplate, mergedInput?.params)
        return callTreaty(ctx.raw, materializedPath, method, mergedInput)
    }

    fn.queryKey = (
        input?: { params?: Record<string, string | number>; query?: unknown }
    ): QueryKey => {
        return buildQueryKey(ctx.prefix, method, pathTemplate, input)
    }

    fn.queryOptions = <TData = unknown>(
        input: MethodDecoratorInput,
        overrides?: Partial<EdenQueryOptions<TData>>
    ): EdenQueryOptions<TData> => {
        return {
            queryKey: fn.queryKey(input),
            queryFn: (context) => {
                const materializedPath = materializePath(pathTemplate, input?.params)
                return dataOrThrow(
                    callTreaty(ctx.raw, materializedPath, method, {
                        ...input,
                        fetch: withContextSignal(input.fetch, context?.signal)
                    })
                )
            },
            ...overrides
        }
    }

    fn.infiniteQueryOptions = <TData = unknown, TPageParam = unknown>(
        input: { params?: Record<string, string | number>; query?: unknown; headers?: unknown; fetch?: RequestInit; cursorKey?: string },
        opts: InfiniteQueryOpts<TData, TPageParam>,
        overrides?: Partial<EdenInfiniteQueryOptions<TData, unknown, TPageParam>>
    ): EdenInfiniteQueryOptions<TData, unknown, TPageParam> => {
        const cursorKey = opts.cursorKey ?? input.cursorKey ?? 'cursor'

        return {
            queryKey: fn.queryKey(input),
            queryFn: (context: QueryFunctionContext<QueryKey, TPageParam>) => {
                const materializedPath = materializePath(pathTemplate, input?.params)
                const queryWithCursor = {
                    ...input.query as Record<string, unknown>,
                    [cursorKey]: context.pageParam
                }
                return dataOrThrow<TData>(callTreaty(ctx.raw, materializedPath, method, {
                    ...input,
                    query: queryWithCursor,
                    fetch: withContextSignal(input.fetch, context.signal)
                }))
            },
            initialPageParam: opts.initialPageParam,
            getNextPageParam: opts.getNextPageParam,
            getPreviousPageParam: opts.getPreviousPageParam,
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
                const vars = variables as MethodDecoratorInput
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

    fn.prefetch = async (
        queryClient: QueryClient,
        input: MethodDecoratorInput
    ): Promise<void> => {
        await queryClient.prefetchQuery(fn.queryOptions(input))
    }

    fn.ensureData = async <TData = unknown>(
        queryClient: QueryClient,
        input: MethodDecoratorInput
    ): Promise<TData> => {
        return queryClient.ensureQueryData(fn.queryOptions<TData>(input))
    }

    fn.setData = <TData = unknown>(
        queryClient: QueryClient,
        input: { params?: Record<string, string | number>; query?: unknown },
        updater: TData | ((old: TData | undefined) => TData | undefined)
    ): TData | undefined => {
        return queryClient.setQueryData<TData>(fn.queryKey(input), updater)
    }

    fn.getData = <TData = unknown>(
        queryClient: QueryClient,
        input: { params?: Record<string, string | number>; query?: unknown }
    ): TData | undefined => {
        return queryClient.getQueryData<TData>(fn.queryKey(input))
    }

    return fn
}

const CTX_SYMBOL = Symbol.for('eden-tq-ctx')

function createEdenTQProxy(
    ctx: ProxyContext,
    paths: string[] = []
): any {
    return new Proxy(() => {}, {
        get(_, prop: string | symbol): any {
            if (prop === CTX_SYMBOL) {
                return ctx
            }

            if (typeof prop === 'symbol') {
                return undefined
            }

            if (isHttpMethod(prop)) {
                return createMethodDecorator(ctx, paths, prop)
            }

            return createEdenTQProxy(
                ctx,
                prop === 'index' ? paths : [...paths, prop]
            )
        },
        apply(_, __, [body]) {
            const paramSegment = resolvePathSegmentFromCallArg(body)
            if (paramSegment !== undefined) {
                return createEdenTQProxy(ctx, [...paths, paramSegment])
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

interface UtilsProxyContext extends ProxyContext {
    queryClient: QueryClient
}

function createUtilsMethodDecorator(
    ctx: UtilsProxyContext,
    paths: string[],
    method: string
) {
    const pathTemplate = [...paths]
    const baseDecorator = createMethodDecorator(ctx, paths, method)

    const fn = {
        queryKey: baseDecorator.queryKey,
        queryOptions: baseDecorator.queryOptions,
        infiniteQueryOptions: baseDecorator.infiniteQueryOptions,
        mutationKey: baseDecorator.mutationKey,
        mutationOptions: baseDecorator.mutationOptions,

        invalidate: async (
            input?: { params?: Record<string, string | number>; query?: unknown },
            exact = false
        ): Promise<void> => {
            return baseDecorator.invalidate(ctx.queryClient, input, exact)
        },

        prefetch: async (input: MethodDecoratorInput): Promise<void> => {
            return baseDecorator.prefetch(ctx.queryClient, input)
        },

        ensureData: async <TData = unknown>(input: MethodDecoratorInput): Promise<TData> => {
            return baseDecorator.ensureData<TData>(ctx.queryClient, input)
        },

        setData: <TData = unknown>(
            input: { params?: Record<string, string | number>; query?: unknown },
            updater: TData | ((old: TData | undefined) => TData | undefined)
        ): TData | undefined => {
            return baseDecorator.setData<TData>(ctx.queryClient, input, updater)
        },

        getData: <TData = unknown>(
            input: { params?: Record<string, string | number>; query?: unknown }
        ): TData | undefined => {
            return baseDecorator.getData<TData>(ctx.queryClient, input)
        },

        cancel: async (
            input?: { params?: Record<string, string | number>; query?: unknown }
        ): Promise<void> => {
            const queryKey = input
                ? baseDecorator.queryKey(input)
                : [...ctx.prefix, method, pathTemplate]
            await ctx.queryClient.cancelQueries({ queryKey })
        },

        refetch: async (
            input?: { params?: Record<string, string | number>; query?: unknown }
        ): Promise<void> => {
            const queryKey = input
                ? baseDecorator.queryKey(input)
                : [...ctx.prefix, method, pathTemplate]
            await ctx.queryClient.refetchQueries({ queryKey })
        }
    }

    return fn
}

function createEdenTQUtilsProxy(
    ctx: UtilsProxyContext,
    paths: string[] = []
): any {
    return new Proxy(() => {}, {
        get(_, prop: string | symbol): any {
            if (typeof prop === 'symbol') {
                return undefined
            }

            if (isHttpMethod(prop)) {
                return createUtilsMethodDecorator(ctx, paths, prop)
            }

            return createEdenTQUtilsProxy(
                ctx,
                prop === 'index' ? paths : [...paths, prop]
            )
        },
        apply(_, __, [body]) {
            const paramSegment = resolvePathSegmentFromCallArg(body)
            if (paramSegment !== undefined) {
                return createEdenTQUtilsProxy(ctx, [...paths, paramSegment])
            }
            return createEdenTQUtilsProxy(ctx, paths)
        }
    })
}

export function createEdenTQUtils<
    const T extends { readonly '~App': any }
>(
    eden: T,
    queryClient: QueryClient
): EdenTQUtils.Create<T['~App']> {
    const ctx = (eden as any)[CTX_SYMBOL] as ProxyContext

    if (!ctx) {
        throw new Error('Invalid eden instance. Make sure you pass the result of createEdenTQ.')
    }

    const utilsCtx: UtilsProxyContext = {
        ...ctx,
        queryClient
    }

    return createEdenTQUtilsProxy(utilsCtx) as EdenTQUtils.Create<T['~App']>
}

export type { EdenTQ, EdenTQUtils, EdenQueryOptions, EdenInfiniteQueryOptions, EdenMutationOptions }
export type { QueryKey, QueryClient, InfiniteData } from '@tanstack/query-core'
