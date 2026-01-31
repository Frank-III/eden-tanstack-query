import type { Elysia, ELYSIA_FORM_DATA } from 'elysia'
import type { QueryKey, QueryClient } from '@tanstack/query-core'
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

type ExtractData<Res extends Record<number, unknown>> =
    Res[Extract<keyof Res, SuccessCodeRange>] extends {
        [ELYSIA_FORM_DATA]: infer Data
    }
        ? Data
        : Res[Extract<keyof Res, SuccessCodeRange>]

type ExtractError<Res extends Record<number, unknown>> = Exclude<
    keyof Res,
    SuccessCodeRange
> extends never
    ? { status: unknown; value: unknown }
    : {
          [Status in keyof Res]: {
              status: Status
              value: Res[Status] extends { [ELYSIA_FORM_DATA]: infer Data }
                  ? Data
                  : Res[Status]
          }
      }[Exclude<keyof Res, SuccessCodeRange>]

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
}

export interface EdenMutationOptions<
    TData = unknown,
    TError = unknown,
    TVariables = unknown
> {
    mutationKey: QueryKey
    mutationFn: (variables: TVariables) => Promise<TData>
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

    queryKey(input?: TQMethodParam<Body, Headers, Query, Params>): QueryKey

    queryOptions<TData = ExtractData<Res>>(
        input: TQMethodParam<Body, Headers, Query, Params>,
        overrides?: Partial<EdenQueryOptions<TData, ExtractError<Res>>>
    ): EdenQueryOptions<TData, ExtractError<Res>>

    mutationKey(input?: TQMethodParam<Body, Headers, Query, Params>): QueryKey

    mutationOptions<TData = ExtractData<Res>>(
        overrides?: Partial<EdenMutationOptions<TData, ExtractError<Res>, TQMethodParam<Body, Headers, Query, Params>>>
    ): EdenMutationOptions<TData, ExtractError<Res>, TQMethodParam<Body, Headers, Query, Params>>

    invalidate(
        queryClient: QueryClient,
        input?: TQMethodParam<Body, Headers, Query, Params>,
        exact?: boolean
    ): Promise<void>
}

export namespace EdenTQ {
    export type Config = Treaty.Config & {
        queryKeyPrefix?: QueryKey
    }

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
            response: infer Res extends Record<number, unknown>
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

export type { QueryKey, QueryClient }
