import type {
    QueryKey,
    QueryClient,
    InfiniteData,
    DataTag,
    QueryObserverOptions,
    InfiniteQueryObserverOptions,
    MutationObserverOptions,
    GetNextPageParamFunction,
    GetPreviousPageParamFunction,
    QueryFunctionContext
} from '@tanstack/query-core'

type IsNever<T> = [T] extends [never] ? true : false

type Prettify<T> = {
    [K in keyof T]: T[K]
} & {}

type UnionToIntersection<U> =
    (U extends any ? (arg: U) => void : never) extends (arg: infer I) => void
        ? I
        : never

export interface EdenAppLike<
    Routes extends Record<any, any> = Record<any, any>
> {
    '~Routes': Routes
}

type NormalizeRouteSchema<Schema extends Record<any, any>> = UnionToIntersection<Schema> extends infer Merged
    ? Merged extends Record<any, any>
        ? Merged
        : never
    : never

type ExtractRouteSchema<App extends EdenAppLike<any>> =
    [App] extends [EdenAppLike<infer Schema extends Record<any, any>>]
        ? NormalizeRouteSchema<Schema>
        : never

type SymbolValue<T> = T extends Record<PropertyKey, unknown>
    ? {
          [K in keyof T]: K extends symbol ? T[K] : never
      }[keyof T]
    : never

type UnwrapFormData<T> = [SymbolValue<T>] extends [never]
    ? T
    : SymbolValue<T>

type NormalizedStatusCode<Status> = Status extends number
    ? Status
    : Status extends `${infer Code extends number}`
      ? Code
      : never

type SuccessStatusKey<Res extends Record<number, unknown>> = {
    [Status in keyof Res]: `${NormalizedStatusCode<Status>}` extends `2${string}`
        ? Status
        : never
}[keyof Res]

type SuccessStatusData<Res extends Record<number, unknown>> = [SuccessStatusKey<Res>] extends [never]
    ? unknown
    : Res[SuccessStatusKey<Res>]

type ErrorStatusKey<Res extends Record<number, unknown>> = Exclude<
    keyof Res,
    SuccessStatusKey<Res>
>

type ExtractData<Res> = Res extends Record<number, unknown>
    ? UnwrapFormData<SuccessStatusData<Res>>
    : unknown

type ExtractError<Res> = Res extends Record<number, unknown>
    ? [ErrorStatusKey<Res>] extends [never]
        ? { status: unknown; value: unknown }
        : {
              [Status in ErrorStatusKey<Res>]: {
                  status: Status
                  value: UnwrapFormData<Res[Status]>
              }
          }[ErrorStatusKey<Res>]
    : { status: unknown; value: unknown }

type TreatyResponseMap<Res> = Res extends Record<number, unknown>
    ? Res
    : Record<number, unknown>

type MaybeArray<T> = T | T[]
type MaybePromise<T> = T | Promise<T>

export interface EdenTreatyConfig {
    fetch?: Omit<RequestInit, 'headers' | 'method'>
    fetcher?: typeof fetch
    headers?: MaybeArray<
        | RequestInit['headers']
        | ((path: string, options: RequestInit) => MaybePromise<RequestInit['headers'] | void>)
    >
    onRequest?: MaybeArray<
        (path: string, options: RequestInit) => MaybePromise<RequestInit | void>
    >
    onResponse?: MaybeArray<(response: Response) => MaybePromise<unknown>>
    keepDomain?: boolean
}

type EdenRawResponseMap<Res extends Record<number, unknown>> =
    | {
          data: UnwrapFormData<SuccessStatusData<Res>>
          error: null
          response: Response
          status: number
          headers: ResponseInit['headers']
      }
    | {
          data: null
          error: ExtractError<Res>
          response: Response
          status: number
          headers: ResponseInit['headers']
      }

export type EdenRawResponse<Res> = EdenRawResponseMap<TreatyResponseMap<Res>>

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

type OmitQueryInput<T> = Omit<T, 'body' | 'headers' | 'fetch'>

type EdenMethodBaseQueryKey<
    Params,
    Query
> = readonly [
    ...QueryKey,
    string,
    readonly string[],
    Params | null,
    SerializeQueryParams<Query> | null
]

type EdenMethodQueryKey<
    Params,
    Query,
    Res
> = DataTag<
    EdenMethodBaseQueryKey<Params, Query>,
    ExtractData<Res>,
    ExtractError<Res>
>

type EdenMethodInfiniteQueryKey<
    Params,
    Query,
    Res,
    TPageParam
> = DataTag<
    EdenMethodBaseQueryKey<Params, Query>,
    InfiniteData<ExtractData<Res>, TPageParam>,
    ExtractError<Res>
>

export interface EdenQueryOptions<
    TQueryFnData = unknown,
    TError = unknown,
    TData = TQueryFnData,
    TQueryKey extends QueryKey = QueryKey
> extends Omit<
    QueryObserverOptions<TQueryFnData, TError, TData, TQueryFnData, TQueryKey>,
    'queryKey' | 'queryFn' | 'persister'
> {
    queryKey: TQueryKey
    queryFn: (context?: QueryFunctionContext<TQueryKey>) => Promise<TQueryFnData>
}

export interface EdenInfiniteQueryOptions<
    TQueryFnData = unknown,
    TError = unknown,
    TData = TQueryFnData,
    TQueryKey extends QueryKey = QueryKey,
    TPageParam = unknown
> extends Omit<
    InfiniteQueryObserverOptions<TQueryFnData, TError, TData, TQueryKey, TPageParam>,
    'queryKey' | 'queryFn' | 'initialPageParam' | 'getNextPageParam' | 'getPreviousPageParam' | 'persister'
> {
    queryKey: TQueryKey
    queryFn: (context: QueryFunctionContext<TQueryKey, TPageParam>) => Promise<TQueryFnData>
    initialPageParam: TPageParam
    getNextPageParam: GetNextPageParamFunction<TPageParam, TQueryFnData>
    getPreviousPageParam?: GetPreviousPageParamFunction<TPageParam, TQueryFnData>
}

export interface EdenMutationOptions<
    TData = unknown,
    TError = unknown,
    TVariables = unknown,
    TOnMutateResult = unknown
> extends Omit<
    MutationObserverOptions<TData, TError, TVariables, TOnMutateResult>,
    'mutationKey' | 'mutationFn'
> {
    mutationKey: QueryKey
    mutationFn: (variables: TVariables) => Promise<TData>
}

type EdenQueryOverrides<
    TQueryFnData,
    TError,
    TData,
    TQueryKey extends QueryKey
> = Partial<Omit<EdenQueryOptions<TQueryFnData, TError, TData, TQueryKey>, 'queryKey' | 'queryFn'>>

type EdenInfiniteQueryOverrides<
    TQueryFnData,
    TError,
    TData,
    TQueryKey extends QueryKey,
    TPageParam
> = Partial<Omit<EdenInfiniteQueryOptions<TQueryFnData, TError, TData, TQueryKey, TPageParam>, 'queryKey' | 'queryFn' | 'initialPageParam' | 'getNextPageParam' | 'getPreviousPageParam'>>

type EdenMutationOverrides<
    TData,
    TError,
    TVariables,
    TOnMutateResult
> = Partial<Omit<EdenMutationOptions<TData, TError, TVariables, TOnMutateResult>, 'mutationKey' | 'mutationFn'>>

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
    Res
> {
    <TQueryFnData = ExtractData<Res>>(
        input: TQMethodParam<Body, Headers, Query, Params>,
        options?: RequestInit
    ): Promise<EdenRawResponse<Res>>

    queryKey(
        input?: OmitQueryInput<TQMethodParam<Body, Headers, Query, Params>>
    ): EdenMethodQueryKey<Params, Query, Res>

    queryOptions<TData = ExtractData<Res>>(
        input: TQMethodParam<Body, Headers, Query, Params>,
        overrides?: EdenQueryOverrides<
            ExtractData<Res>,
            ExtractError<Res>,
            TData,
            EdenMethodQueryKey<Params, Query, Res>
        >
    ): EdenQueryOptions<
        ExtractData<Res>,
        ExtractError<Res>,
        TData,
        EdenMethodQueryKey<Params, Query, Res>
    >

    infiniteQueryOptions<TData = ExtractData<Res>, TPageParam = unknown>(
        input: InfiniteQueryInput<TPageParam, Query, Params>,
        opts: {
            initialPageParam: TPageParam
            getNextPageParam: GetNextPageParamFunction<TPageParam, ExtractData<Res>>
            getPreviousPageParam?: GetPreviousPageParamFunction<TPageParam, ExtractData<Res>>
            cursorKey?: string
        },
        overrides?: EdenInfiniteQueryOverrides<
            ExtractData<Res>,
            ExtractError<Res>,
            TData,
            EdenMethodInfiniteQueryKey<Params, Query, Res, TPageParam>,
            TPageParam
        >
    ): EdenInfiniteQueryOptions<
        ExtractData<Res>,
        ExtractError<Res>,
        TData,
        EdenMethodInfiniteQueryKey<Params, Query, Res, TPageParam>,
        TPageParam
    >

    mutationKey(input?: OmitQueryInput<TQMethodParam<Body, Headers, Query, Params>>): QueryKey

    mutationOptions<TData = ExtractData<Res>, TOnMutateResult = unknown>(
        overrides?: EdenMutationOverrides<
            TData,
            ExtractError<Res>,
            TQMethodParam<Body, Headers, Query, Params>,
            TOnMutateResult
        >
    ): EdenMutationOptions<
        TData,
        ExtractError<Res>,
        TQMethodParam<Body, Headers, Query, Params>,
        TOnMutateResult
    >

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
    export type Config = EdenTreatyConfig & {
        queryKeyPrefix?: QueryKey
    }

    export type Create<App extends EdenAppLike<any>> =
        Prettify<Sign<ExtractRouteSchema<App>>> &
            CreateParams<ExtractRouteSchema<App>> & { readonly '~App': App }

    export type CreateFromSchema<Schema extends Record<any, any>> =
        Prettify<Sign<NormalizeRouteSchema<Schema>>> &
            CreateParams<NormalizeRouteSchema<Schema>> & { readonly '~App': EdenAppLike<Schema> }

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
    Res
> {
    queryKey(
        input?: OmitQueryInput<TQMethodParam<Body, Headers, Query, Params>>
    ): EdenMethodQueryKey<Params, Query, Res>

    queryOptions<TData = ExtractData<Res>>(
        input: TQMethodParam<Body, Headers, Query, Params>,
        overrides?: EdenQueryOverrides<
            ExtractData<Res>,
            ExtractError<Res>,
            TData,
            EdenMethodQueryKey<Params, Query, Res>
        >
    ): EdenQueryOptions<
        ExtractData<Res>,
        ExtractError<Res>,
        TData,
        EdenMethodQueryKey<Params, Query, Res>
    >

    infiniteQueryOptions<TData = ExtractData<Res>, TPageParam = unknown>(
        input: InfiniteQueryInput<TPageParam, Query, Params>,
        opts: {
            initialPageParam: TPageParam
            getNextPageParam: GetNextPageParamFunction<TPageParam, ExtractData<Res>>
            getPreviousPageParam?: GetPreviousPageParamFunction<TPageParam, ExtractData<Res>>
            cursorKey?: string
        },
        overrides?: EdenInfiniteQueryOverrides<
            ExtractData<Res>,
            ExtractError<Res>,
            TData,
            EdenMethodInfiniteQueryKey<Params, Query, Res, TPageParam>,
            TPageParam
        >
    ): EdenInfiniteQueryOptions<
        ExtractData<Res>,
        ExtractError<Res>,
        TData,
        EdenMethodInfiniteQueryKey<Params, Query, Res, TPageParam>,
        TPageParam
    >

    mutationKey(input?: OmitQueryInput<TQMethodParam<Body, Headers, Query, Params>>): QueryKey

    mutationOptions<TData = ExtractData<Res>, TOnMutateResult = unknown>(
        overrides?: EdenMutationOverrides<
            TData,
            ExtractError<Res>,
            TQMethodParam<Body, Headers, Query, Params>,
            TOnMutateResult
        >
    ): EdenMutationOptions<
        TData,
        ExtractError<Res>,
        TQMethodParam<Body, Headers, Query, Params>,
        TOnMutateResult
    >

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
    export type Create<App extends EdenAppLike<any>> =
        Prettify<Sign<ExtractRouteSchema<App>>> & CreateParams<ExtractRouteSchema<App>>

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
