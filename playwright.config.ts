import { defineConfig } from '@playwright/test'
export default defineConfig({
  testDir: './e2e',
  timeout: 60000,
  use: {
    baseURL: 'http://localhost:5199',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  outputDir: './e2e/artifacts/g2rv',
})

