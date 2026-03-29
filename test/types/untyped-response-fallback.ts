import { createEdenTQ, type EdenAppLike } from "../../src";

type NeverResponseApp = EdenAppLike<{
  foo: {
    get: {
      body: never;
      headers: never;
      params: never;
      query: never;
      response: never;
    };
    post: {
      body: { bar: string };
      headers: never;
      params: never;
      query: never;
      response: never;
    };
  };
}>;

const eden = createEdenTQ<NeverResponseApp>("http://localhost:3000");

type IsAny<T> = 0 extends 1 & T ? true : false;

{
  const options = eden.foo.get.queryOptions({});
  const value = await options.queryFn();
  const valueIsAny: IsAny<typeof value> = false;
  void valueIsAny;
  // @ts-expect-error unknown value should not allow arbitrary property access
  void value.anyField;
}

{
  const options = eden.foo.post.mutationOptions();
  const value = await options.mutationFn({ body: { bar: "x" } });
  const valueIsAny: IsAny<typeof value> = false;
  void valueIsAny;
  // @ts-expect-error unknown value should not allow arbitrary property access
  void value.anyField;
}
