import { resolve } from 'path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      '@renderer': resolve('src/renderer'),
      '@shared': resolve('src/shared')
    }
  },
  test: {
    include: ['tests/**/*.test.{ts,tsx}'],
    // Component tests opt in to a DOM with `// @vitest-environment jsdom`.
    environment: 'node'
  },
  esbuild: { jsx: 'automatic' }
})
