import { defineConfig } from "vite-plus";

export default defineConfig({
  staged: {
    "*": "vp check --fix",
  },
  pack: {
    entry: ["src/index.ts"],
    format: ["esm"],
    dts: true,
    clean: true,
    minify: true,
    deps: {
      neverBundle: ["elysia", "@elysiajs/eden", "@tanstack/query-core"],
    },
  },
  lint: { options: { typeAware: true } },
});
