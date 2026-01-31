#!/bin/bash
# Sync from eden fork to standalone package

EDEN_SRC="/Users/new/projects/learn_ts/eden/src/tanstack-query"
PKG_SRC="/Users/new/projects/learn_ts/eden-tanstack-query/src"

# Copy files
cp "$EDEN_SRC/index.ts" "$PKG_SRC/index.ts"
cp "$EDEN_SRC/types.ts" "$PKG_SRC/types.ts"

# Fix imports for standalone package
sed -i '' "s|from '../treaty2'|from '@elysiajs/eden/treaty2'|g" "$PKG_SRC/index.ts"
sed -i '' "s|from '../types'|// types inlined|g" "$PKG_SRC/types.ts"
sed -i '' "s|from '../treaty2/types'|from '@elysiajs/eden/treaty2'|g" "$PKG_SRC/types.ts"

# Add missing types if not present
if ! grep -q "type IsNever" "$PKG_SRC/types.ts"; then
  sed -i '' "s|import type { Treaty }|import type { Treaty } from '@elysiajs/eden/treaty2'\n\ntype IsNever<T> = [T] extends [never] ? true : false\n\ntype Prettify<T> = {\n    [K in keyof T]: T[K]\n} \& {}\n\n// import type { Treaty }|" "$PKG_SRC/types.ts"
fi

echo "✓ Synced from eden fork to standalone package"
