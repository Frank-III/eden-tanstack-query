import { Elysia, sse, t } from "elysia";
import { QueryClient } from "@tanstack/query-core";
import { createEdenTQ } from "../src";
import { describe, expect, it } from "vite-plus/test";

const app = new Elysia()
  .get(
    "/chat",
    async function* ({ query }) {
      const count = Number(query.count ?? 3);
      for (let i = 0; i < count; i++) {
        yield `chunk-${i}`;
      }
    },
    {
      query: t.Object({ count: t.Optional(t.String()) }),
    },
  )
  .get("/counter", async function* () {
    yield 1;
    yield 2;
    yield 3;
  })
  .get("/empty", async function* () {
    // never yields
    if (false as boolean) yield "unreachable";
  });

describe("streamedOptions", () => {
  const eden = createEdenTQ<typeof app>(app);

  it("builds options with a queryKey that matches queryOptions shape", () => {
    const options = eden.chat.get.streamedOptions({ query: { count: "2" } });
    expect(options.queryKey).toEqual(["eden", "get", ["chat"], null, { count: "2" }]);
  });

  it("accumulates streamed chunks into an array via experimental_streamedQuery", async () => {
    const client = new QueryClient();
    const options = eden.chat.get.streamedOptions<string>({ query: { count: "4" } });

    const data = await client.fetchQuery(options);
    expect(data).toEqual(["chunk-0", "chunk-1", "chunk-2", "chunk-3"]);
  });

  it("passes through overrides like staleTime", () => {
    const options = eden.counter.get.streamedOptions(undefined, { staleTime: 5000 });
    expect(options.staleTime).toBe(5000);
  });

  it("supports refetchMode via queryFnOptions", () => {
    const options = eden.counter.get.streamedOptions(undefined, {
      queryFnOptions: { refetchMode: "reset" },
    });
    expect(typeof options.queryFn).toBe("function");
  });
});

describe("liveOptions", () => {
  const eden = createEdenTQ<typeof app>(app);

  it("builds options with the same queryKey shape as queryOptions", () => {
    const options = eden.counter.get.liveOptions();
    expect(options.queryKey).toEqual(["eden", "get", ["counter"], null, null]);
  });

  it("writes each chunk to the cache and resolves to the last chunk", async () => {
    const client = new QueryClient();
    const options = eden.counter.get.liveOptions<number>();

    const final = await client.fetchQuery(options);
    expect(final).toBe(3);
    expect(client.getQueryData(options.queryKey)).toBe(3);
  });

  it("rejects routes that do not return an async iterable", async () => {
    const nonStreamingApp = new Elysia().get("/plain", () => ({ ok: true }));
    const plainEden = createEdenTQ<typeof nonStreamingApp>(nonStreamingApp);
    const client = new QueryClient();
    const options = plainEden.plain.get.liveOptions<unknown>(undefined, { retry: false });

    await expect(client.fetchQuery(options)).rejects.toThrow(/AsyncIterable/);
  });
});

describe("Elysia sse() helper compatibility", () => {
  const sseApp = new Elysia()
    .get("/sse-stream", async function* () {
      yield sse({ data: "alpha", event: "message" });
      yield sse({ data: "beta", event: "message" });
      yield sse({ data: "gamma", event: "message" });
    })
    .get("/sse-live", async function* () {
      yield sse({ data: { tick: 1 } });
      yield sse({ data: { tick: 2 } });
    });

  const eden = createEdenTQ<typeof sseApp>(sseApp);

  it("streamedOptions accumulates chunks from a route returning sse() payloads", async () => {
    const client = new QueryClient();
    const options = eden["sse-stream"].get.streamedOptions();

    const data = await client.fetchQuery(options);
    expect(Array.isArray(data)).toBe(true);
    expect(data).toHaveLength(3);
  });

  it("liveOptions resolves to the last sse() chunk", async () => {
    const client = new QueryClient();
    const options = eden["sse-live"].get.liveOptions();

    const final = await client.fetchQuery(options);
    expect(final).toBeDefined();
    expect(client.getQueryData(options.queryKey)).toEqual(final);
  });
});
