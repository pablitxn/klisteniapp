import { defineConfig } from '@playwright/test'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  testDir: './e2e', testMatch: 'b2b.spec.ts', fullyParallel: false, workers: 1,
  forbidOnly: Boolean(process.env.CI), retries: 0, timeout: 90_000,
  outputDir: process.env.CI ? './b2b-test-results' : '../../.cache/b2b/browser-results', reporter: 'list',
  use: { baseURL: 'http://127.0.0.1:4202', viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce', trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  webServer: {
    command: 'pnpm --filter @klisteniapp/member-web --filter @klisteniapp/backoffice build && node scripts/b2b-e2e-server.mjs',
    cwd: fileURLToPath(new URL('../..', import.meta.url)),
    url: 'http://127.0.0.1:4202/healthz', reuseExistingServer: false, timeout: 180_000,
    gracefulShutdown: { signal: 'SIGTERM', timeout: 15000 },
  },
})
