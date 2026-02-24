import { Elysia, t } from "elysia";
import { QueryClient } from "@tanstack/query-core";
import { createEdenTQ } from "../../src";

const app = new Elysia()
  .get(
    "/contacts/:id/communications",
    ({ params, query }) => ({
      id: params.id,
      items: [] as string[],
      limit: query.limit ?? null,
      offset: query.offset ?? null,
    }),
    {
      query: t.Object({
        limit: t.Optional(t.Number()),
        offset: t.Optional(t.Number()),
      }),
      response: t.Object({
        id: t.String(),
        items: t.Array(t.String()),
        limit: t.Nullable(t.Number()),
        offset: t.Nullable(t.Number()),
      }),
    },
  )
  .get(
    "/search",
    ({ query }) => ({
      q: query.q,
      limit: query.limit ?? null,
    }),
    {
      query: t.Object({
        q: t.String(),
        limit: t.Optional(t.Number()),
      }),
      response: t.Object({
        q: t.String(),
        limit: t.Nullable(t.Number()),
      }),
    },
  );

const eden = createEdenTQ<typeof app>("http://localhost:3000");

{
  const queryClient = new QueryClient();

  // Optional-only query object should not force `query` to be present.
  eden.contacts({ id: "contact-1" }).communications.get.queryOptions({
    params: { id: "contact-1" },
  });

  eden.contacts({ id: "contact-1" }).communications.get.queryKey({
    params: { id: "contact-1" },
  });

  await eden
    .contacts({ id: "contact-1" })
    .communications.get.invalidate(queryClient, { params: { id: "contact-1" } });
}

{
  // Required query key should still be required.
  // @ts-expect-error missing required `query.q`
  eden.search.get.queryOptions({});

  eden.search.get.queryOptions({
    query: { q: "term" },
  });
}
