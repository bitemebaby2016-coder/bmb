import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test-setup.ts',
    include: ['src/**/*.{test,spec}.{js,ts}'],
    // exclude local worktree copies (src/.kilo/**) — duplicates of real tests,
    // not part of the canonical suite (stale copies cause flaky failures)
    exclude: ['src/.kilo/**', 'node_modules/**', 'dist/**'],
  },
  resolve: {
    alias: {
      '@': join(dirname(fileURLToPath(import.meta.url)), 'src'),
    },
  },
})