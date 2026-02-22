import { describe, expect, it } from 'bun:test'

describe('package metadata', () => {
    it('declares elysia as a peer dependency', async () => {
        const pkg = await Bun.file(new URL('../package.json', import.meta.url)).json() as {
            peerDependencies?: Record<string, string>
        }

        expect(pkg.peerDependencies?.elysia).toBe('>=1.0.0')
    })
})

