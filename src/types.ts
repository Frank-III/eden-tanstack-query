import type { Elysia, ELYSIA_FORM_DATA } from 'elysia'
import type {
    QueryKey,
    QueryClient,
    InfiniteData,
    GetNextPageParamFunction,
    GetPreviousPageParamFunction,
    QueryFunctionContext
} from '@tanstack/query-core'
import type { Treaty } from '@elysiajs/eden/treaty2'

type IsNever<T> = [T] extends [never] ? true : false

type Prettify<T> = {
    [K in keyof T]: T[K]
} & {}

type Enumerate<
    N extends number,
    Acc extends number[] = []
> = Acc['length'] extends N
    ? Acc[number]
    : Enumerate<N, [...Acc, Acc['length']]>

type IntegerRange<F extends number, T extends number> = Exclude<
    Enumerate<T>,
    Enumerate<F>
>

type SuccessCodeRange = IntegerRange<200, 300>

type ExtractData<Res> = Res extends Record<number, unknown>
    ? Res[Extract<keyof Res, SuccessCodeRange>] extends {
          [ELYSIA_FORM_DATA]: infer Data
      }
        ? Data
        : Res[Extract<keyof Res, SuccessCodeRange>]
    : unknown

type ExtractError<Res> = Res extends Record<number, unknown>
    ? Exclude<keyof Res, SuccessCodeRange> extends never
        ? { status: unknown; value: unknown }
        : {
              [Status in keyof Res]: {
                  status: Status
                  value: Res[Status] extends { [ELYSIA_FORM_DATA]: infer Data }
                      ? Data
                      : Res[Status]
              }
          }[Exclude<keyof Res, SuccessCodeRange>]
    : { status: unknown; value: unknown }

interface TQParamBase {
    fetch?: RequestInit
}

type SerializeQueryParams<T> = T extends Record<string, any>
    ? {
          [K in keyof T]: T[K] extends Date
              ? string
              : T[K] extends Date | undefined
                  ? string | undefined
                  : T[K]
      }
    : T

type IsEmptyObject<T> = T extends Record<string, never>
    ? [keyof T] extends [never]
        ? true
        : false
    : false

type MaybeEmptyObject<T, K extends PropertyKey> = [T] extends [never]
    ? {}
    : [T] extends [undefined]
      ? { [P in K]?: T }
      : IsEmptyObject<T> extends true
        ? { [P in K]?: T }
        : undefined extends T
          ? { [P in K]?: T }
          : { [P in K]: T }

type TQMethodParam<
    Body,
    Headers,
    Query,
    Params
> = MaybeEmptyObject<Headers, 'headers'> &
    MaybeEmptyObject<SerializeQueryParams<Query>, 'query'> &
    MaybeEmptyObject<Params, 'params'> &
    MaybeEmptyObject<Body, 'body'> &
    TQParamBase

export interface EdenQueryOptions<TData = unknown, TError = unknown> {
    queryKey: QueryKey
    queryFn: () => Promise<TData>
    enabled?: boolean
    staleTime?: number
    gcTime?: number
    refetchOnMount?: boolean | 'always'
    refetchOnWindowFocus?: boolean | 'always'
    refetchOnReconnect?: boolean | 'always'
    refetchInterval?: number | false
    retry?: boolean | number | ((failureCount: number, error: TError) => boolean)
    retryDelay?: number | ((failureCount: number, error: TError) => number)
    placeholderData?: TData | (() => TData | undefined)
}

export interface EdenInfiniteQueryOptions<
    TData = unknown,
    TError = unknown,
    TPageParam = unknown
> {
    queryKey: QueryKey
    queryFn: (context: QueryFunctionContext<QueryKey, TPageParam>) => Promise<TData>
    initialPageParam: TPageParam
    getNextPageParam: GetNextPageParamFunction<TPageParam, TData>
    getPreviousPageParam?: GetPreviousPageParamFunction<TPageParam, TData>
    enabled?: boolean
    staleTime?: number
    gcTime?: number
    refetchOnMount?: boolean | 'always'
    refetchOnWindowFocus?: boolean | 'always'
    refetchOnReconnect?: boolean | 'always'
    maxPages?: number
}

export interface EdenMutationOptions<
    TData = unknown,
    TError = unknown,
    TVariables = unknown
> {
    mutationKey: QueryKey
    mutationFn: (variables: TVariables) => Promise<TData>
    onMutate?: (variables: TVariables) => Promise<unknown> | unknown
    onSuccess?: (data: TData, variables: TVariables, context: unknown) => Promise<unknown> | unknown
    onError?: (error: TError, variables: TVariables, context: unknown) => Promise<unknown> | unknown
    onSettled?: (data: TData | undefined, error: TError | null, variables: TVariables, context: unknown) => Promise<unknown> | unknown
    retry?: boolean | number | ((failureCount: number, error: TError) => boolean)
    retryDelay?: number | ((failureCount: number, error: TError) => number)
}

type OmitQueryInput<T> = Omit<T, 'body' | 'headers' | 'fetch'>

export interface InfiniteQueryInput<TPageParam, Query, Params> {
    params?: Params
    query?: Omit<Query, 'cursor'> & { cursor?: TPageParam }
    headers?: Record<string, string>
    fetch?: RequestInit
    cursorKey?: string
}

export interface EdenTQMethod<
    Body,
    Headers,
    Query,
    Params,
    Res extends Record<number, unknown>
> {
    <TQueryFnData = ExtractData<Res>>(
        input: TQMethodParam<Body, Headers, Query, Params>,
        options?: RequestInit
    ): Promise<Treaty.TreatyResponse<Res>>

    queryKey(input?: OmitQueryInput<TQMethodParam<Body, Headers, Query, Params>>): QueryKey

    queryOptions<TData = ExtractData<Res>>(
        input: TQMethodParam<Body, Headers, Query, Params>,
        overrides?: Partial<EdenQueryOptions<TData, ExtractError<Res>>>
    ): EdenQueryOptions<TData, ExtractError<Res>>

    infiniteQueryOptions<TData = ExtractData<Res>, TPageParam = unknown>(
        input: InfiniteQueryInput<TPageParam, Query, Params>,
        opts: {
            initialPageParam: TPageParam
            getNextPageParam: GetNextPageParamFunction<TPageParam, TData>
            getPreviousPageParam?: GetPreviousPageParamFunction<TPageParam, TData>
            cursorKey?: string
        },
        overrides?: Partial<Omit<EdenInfiniteQueryOptions<TData, ExtractError<Res>, TPageParam>, 'queryKey' | 'queryFn' | 'initialPageParam' | 'getNextPageParam' | 'getPreviousPageParam'>>
    ): EdenInfiniteQueryOptions<TData, ExtractError<Res>, TPageParam>

    mutationKey(input?: OmitQueryInput<TQMethodParam<Body, Headers, Query, Params>>): QueryKey

    mutationOptions<TData = ExtractData<Res>>(
        overrides?: Partial<EdenMutationOptions<TData, ExtractError<Res>, TQMethodParam<Body, Headers, Query, Params>>>
    ): EdenMutationOptions<TData, ExtractError<Res>, TQMethodParam<Body, Headers, Query, Params>>

    invalidate(
        queryClient: QueryClient,
        input?: OmitQueryInput<TQMethodParam<Body, Headers, Query, Params>>,
        exact?: boolean
    ): Promise<void>

    prefetch(
        queryClient: QueryClient,
        input: TQMethodParam<Body, Headers, Query, Params>
    ): Promise<void>

    ensureData<TData = ExtractData<Res>>(
        queryClient: QueryClient,
        input: TQMethodParam<Body, Headers, Query, Params>
    ): Promise<TData>

    setData<TData = ExtractData<Res>>(
        queryClient: QueryClient,
        input: OmitQueryInput<TQMethodParam<Body, Headers, Query, Params>>,
        updater: TData | ((old: TData | undefined) => TData | undefined)
    ): TData | undefined

    getData<TData = ExtractData<Res>>(
        queryClient: QueryClient,
        input: OmitQueryInput<TQMethodParam<Body, Headers, Query, Params>>
    ): TData | undefined
}

export namespace EdenTQ {
    export type Config = Treaty.Config & {
        queryKeyPrefix?: QueryKey
    }

    export type Create<App extends Elysia<any, any, any, any, any, any, any>> =
        App extends {
            '~Routes': infer Schema extends Record<any, any>
        }
            ? Prettify<Sign<Schema>> & CreateParams<Schema> & { readonly '~App': App }
            : 'Please install Elysia before using Eden'

    export type Sign<in out Route extends Record<any, any>> = {
        [K in keyof Route as K extends `:${string}`
            ? never
            : K]: Route[K] extends {
            body: infer Body
            headers: infer Headers
            params: infer Params
            query: infer Query
            response: infer Res
        }
            ? EdenTQMethod<Body, Headers, Query, Params, Res>
            : CreateParams<Route[K]>
    }

    type CreateParams<Route extends Record<string, any>> =
        Extract<keyof Route, `:${string}`> extends infer Path extends string
            ? IsNever<Path> extends true
                ? Prettify<Sign<Route>>
                : (((params: {
                      [param in Path extends `:${infer Param}`
                          ? Param extends `${infer P}?`
                              ? P
                              : Param
                          : never]: string | number
                  }) => Prettify<Sign<Route[Path]>> &
                      CreateParams<Route[Path]>) &
                      Prettify<Sign<Route>>) &
                      (Path extends `:${string}?`
                          ? CreateParams<Route[Path]>
                          : {})
            : never
}

export interface EdenTQUtilsMethod<
    Body,
    Headers,
    Query,
    Params,
    Res extends Record<number, unknown>
> {
    queryKey(input?: OmitQueryInput<TQMethodParam<Body, Headers, Query, Params>>): QueryKey

    queryOptions<TData = ExtractData<Res>>(
        input: TQMethodParam<Body, Headers, Query, Params>,
        overrides?: Partial<EdenQueryOptions<TData, ExtractError<Res>>>
    ): EdenQueryOptions<TData, ExtractError<Res>>

    infiniteQueryOptions<TData = ExtractData<Res>, TPageParam = unknown>(
        input: InfiniteQueryInput<TPageParam, Query, Params>,
        opts: {
            initialPageParam: TPageParam
            getNextPageParam: GetNextPageParamFunction<TPageParam, TData>
            getPreviousPageParam?: GetPreviousPageParamFunction<TPageParam, TData>
            cursorKey?: string
        },
        overrides?: Partial<Omit<EdenInfiniteQueryOptions<TData, ExtractError<Res>, TPageParam>, 'queryKey' | 'queryFn' | 'initialPageParam' | 'getNextPageParam' | 'getPreviousPageParam'>>
    ): EdenInfiniteQueryOptions<TData, ExtractError<Res>, TPageParam>

    mutationKey(input?: OmitQueryInput<TQMethodParam<Body, Headers, Query, Params>>): QueryKey

    mutationOptions<TData = ExtractData<Res>>(
        overrides?: Partial<EdenMutationOptions<TData, ExtractError<Res>, TQMethodParam<Body, Headers, Query, Params>>>
    ): EdenMutationOptions<TData, ExtractError<Res>, TQMethodParam<Body, Headers, Query, Params>>

    invalidate(
        input?: OmitQueryInput<TQMethodParam<Body, Headers, Query, Params>>,
        exact?: boolean
    ): Promise<void>

    prefetch(
        input: TQMethodParam<Body, Headers, Query, Params>
    ): Promise<void>

    ensureData<TData = ExtractData<Res>>(
        input: TQMethodParam<Body, Headers, Query, Params>
    ): Promise<TData>

    setData<TData = ExtractData<Res>>(
        input: OmitQueryInput<TQMethodParam<Body, Headers, Query, Params>>,
        updater: TData | ((old: TData | undefined) => TData | undefined)
    ): TData | undefined

    getData<TData = ExtractData<Res>>(
        input: OmitQueryInput<TQMethodParam<Body, Headers, Query, Params>>
    ): TData | undefined

    cancel(
        input?: OmitQueryInput<TQMethodParam<Body, Headers, Query, Params>>
    ): Promise<void>

    refetch(
        input?: OmitQueryInput<TQMethodParam<Body, Headers, Query, Params>>
    ): Promise<void>
}

export namespace EdenTQUtils {
    export type Create<App extends Elysia<any, any, any, any, any, any, any>> =
        App extends {
            '~Routes': infer Schema extends Record<any, any>
        }
            ? Prettify<Sign<Schema>> & CreateParams<Schema>
            : 'Please install Elysia before using Eden'

    export type Sign<in out Route extends Record<any, any>> = {
        [K in keyof Route as K extends `:${string}`
            ? never
            : K]: Route[K] extends {
            body: infer Body
            headers: infer Headers
            params: infer Params
            query: infer Query
            response: infer Res
        }
            ? EdenTQUtilsMethod<Body, Headers, Query, Params, Res>
            : CreateParams<Route[K]>
    }

    type CreateParams<Route extends Record<string, any>> =
        Extract<keyof Route, `:${string}`> extends infer Path extends string
            ? IsNever<Path> extends true
                ? Prettify<Sign<Route>>
                : (((params: {
                      [param in Path extends `:${infer Param}`
                          ? Param extends `${infer P}?`
                              ? P
                              : Param
                          : never]: string | number
                  }) => Prettify<Sign<Route[Path]>> &
                      CreateParams<Route[Path]>) &
                      Prettify<Sign<Route>>) &
                      (Path extends `:${string}?`
                          ? CreateParams<Route[Path]>
                          : {})
            : never
}

export type { QueryKey, QueryClient, InfiniteData }
