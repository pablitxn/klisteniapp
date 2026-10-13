import { defineConfig } from '@playwright/test'
import { fileURLToPath } from 'node:url'
import { readFileSync } from 'node:fs'
import { createHash, createPublicKey } from 'node:crypto'

const root = fileURLToPath(new URL('../..', import.meta.url))
const cert = readFileSync(`${root}/.cache/wl/tls/server.crt`)
const spki = createHash('sha256')
  .update(createPublicKey(cert).export({ type: 'spki', format: 'der' }))
  .digest('base64')
const chromium = {
  ...(process.env.TRAINER_CHROMIUM_EXECUTABLE
    ? { executablePath: process.env.TRAINER_CHROMIUM_EXECUTABLE }
    : {}),
  args: [`--ignore-certificate-errors-spki-list=${spki}`],
}
const results = process.env.TRAINER_RESULTS_ROOT ?? '../../.cache/trainer'

export default defineConfig({
  testDir: './e2e',
  testMatch: 'b2b-trainer.spec.ts',
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  timeout: 180_000,
  outputDir: `${results}/browser-results`,
  reporter: [
    ['list'],
    ['json', { outputFile: `${results}/results.json` }],
    ['html', { outputFolder: `${results}/browser-report`, open: 'never' }],
  ],
  use: {
    baseURL: 'https://atlas.b2b.test',
    reducedMotion: 'reduce',
    locale: 'es-AR',
    timezoneId: 'UTC',
    colorScheme: 'light',
    trace: 'on',
    screenshot: 'only-on-failure',
    ignoreHTTPSErrors: false,
    actionTimeout: 15_000,
  },
  projects: [
    {
      name: 'trainer-chromium-narrow',
      use: {
        browserName: 'chromium',
        launchOptions: chromium,
        proxy: { server: 'http://127.0.0.1:4362' },
        viewport: { width: 360, height: 800 },
        isMobile: true,
        hasTouch: true,
      },
    },
    {
      name: 'trainer-chromium-wide',
      use: {
        browserName: 'chromium',
        launchOptions: chromium,
        proxy: { server: 'http://127.0.0.1:4364' },
        viewport: { width: 430, height: 932 },
        isMobile: true,
        hasTouch: true,
      },
    },
    {
      name: 'trainer-chromium-desktop',
      use: {
        browserName: 'chromium',
        launchOptions: chromium,
        proxy: { server: 'http://127.0.0.1:4366' },
        viewport: { width: 1440, height: 1000 },
      },
    },
    {
      name: 'trainer-webkit-narrow',
      use: {
        browserName: 'webkit',
        baseURL:
          process.env.TRAINER_WEBKIT_HTTP === '1'
            ? 'http://localhost:4468'
            : 'https://atlas.b2b.test',
        launchOptions: process.env.TRAINER_WEBKIT_EXECUTABLE
          ? { executablePath: process.env.TRAINER_WEBKIT_EXECUTABLE }
          : {},
        ...(process.env.TRAINER_WEBKIT_HTTP === '1'
          ? {}
          : { proxy: { server: 'http://127.0.0.1:4368' } }),
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
      },
    },
  ],
  webServer: {
    command: 'pnpm --filter @klisteniapp/b2b-web build && node scripts/b2b-trainer-e2e-server.mjs',
    cwd: root,
    url: 'http://127.0.0.1:4360/',
    reuseExistingServer: process.env.TRAINER_REUSE_SERVER === '1',
    timeout: 180_000,
    gracefulShutdown: { signal: 'SIGTERM', timeout: 15000 },
  },
})
