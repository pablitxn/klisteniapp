import { defineConfig, devices } from '@playwright/test'
import { fileURLToPath } from 'node:url'

const softwareWebGL = { args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] }

export default defineConfig({
  testDir: './e2e',
  testMatch: 'b2b*.spec.ts',
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  timeout: 90_000,
  outputDir: process.env.CI ? './b2b-test-results' : '../../.cache/b2b/browser-results',
  reporter: [['list'], ['html', { outputFolder: process.env.CI ? 'b2b-report' : '../../.cache/b2b/browser-report', open: 'never' }]],
  snapshotPathTemplate: '{testDir}/snapshots/b2b/{projectName}/{arg}{ext}',
  expect: { toHaveScreenshot: { animations: 'disabled', caret: 'hide', maxDiffPixelRatio: 0.002 } },
  use: {
    reducedMotion: 'reduce',
    locale: 'es-AR',
    timezoneId: 'UTC',
    colorScheme: 'light',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  // Each project owns a separate database schema, API, media directory and
  // origin. Destructive/publication flows cannot leak state into another engine.
  projects: [
    { name: 'chromium-desktop', use: { browserName: 'chromium', launchOptions: softwareWebGL, baseURL: 'http://127.0.0.1:4202', viewport: { width: 1440, height: 1000 } } },
    { name: 'chromium-touch', use: { ...devices['Pixel 7'], launchOptions: softwareWebGL, baseURL: 'http://127.0.0.1:4204' } },
    { name: 'webkit-touch', use: { ...devices['iPhone 13'], baseURL: 'http://127.0.0.1:4206' } },
  ],
  webServer: {
    command: 'pnpm --filter @klisteniapp/member-web --filter @klisteniapp/backoffice build && node scripts/b2b-e2e-server.mjs',
    cwd: fileURLToPath(new URL('../..', import.meta.url)),
    // The last gateway only starts after all three isolated databases are seeded.
    url: 'http://127.0.0.1:4206/healthz',
    reuseExistingServer: false,
    timeout: 180_000,
    gracefulShutdown: { signal: 'SIGTERM', timeout: 15000 },
  },
})
