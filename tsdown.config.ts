import { defineConfig } from 'tsdown'

export default defineConfig({
	entry: ['src/index.ts'],
	format: ['esm'],
	dts: true,
	clean: true,
	minify: true,
	external: ['elysia', '@elysiajs/eden', '@tanstack/query-core']
})
