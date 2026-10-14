import { defineConfig } from '@playwright/test'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../..', import.meta.url))
const views = [
  { name: 'narrow', viewport: { width: 360, height: 800 }, isMobile: true, hasTouch: true },
  { name: 'wide', viewport: { width: 430, height: 932 }, isMobile: true, hasTouch: true },
  { name: 'desktop', viewport: { width: 1440, height: 1000 }, isMobile: false, hasTouch: false },
]
export default defineConfig({
  testDir: './e2e',
  testMatch: 'b2b-anonymous.spec.ts',
  fullyParallel: false,
  workers: 3,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  timeout: 60_000,
  outputDir: '../../.cache/qa-anonymous/results',
  reporter: [
    ['list'],
    ['json', { outputFile: '../../.cache/qa-anonymous/results.json' }],
    ['html', { outputFolder: '../../.cache/qa-anonymous/report', open: 'never' }],
  ],
  use: {
    baseURL: 'https://atlas.b2b.test',
    locale: 'es-AR',
    timezoneId: 'UTC',
    reducedMotion: 'reduce',
    colorScheme: 'light',
    ignoreHTTPSErrors: false,
    trace: 'on',
    screenshot: 'on',
  },
  projects: ['chromium', 'webkit'].flatMap((browserName, engine) =>
    views.map((view, index) => ({
      name: `anonymous-${browserName}-${view.name}`,
      metadata: {
        fixtureIndex: engine * 3 + index,
        protocol:
          browserName === 'webkit' && process.env.QA_WEBKIT_HTTP === 'true' ? 'http' : 'https',
      },
      use: {
        ...view,
        browserName: browserName as 'chromium' | 'webkit',
        proxy: {
          server: `http://127.0.0.1:${[4342, 4344, 4346, 4350, 4352, 4354][engine * 3 + index]}`,
        },
        launchOptions:
          browserName === 'chromium'
            ? {
                executablePath: process.env.QA_CHROMIUM_EXECUTABLE || '/usr/bin/chromium',
              }
            : process.env.QA_WEBKIT_EXECUTABLE
              ? { executablePath: process.env.QA_WEBKIT_EXECUTABLE }
              : {},
      },
    })),
  ),
  webServer: {
    command: 'pnpm --filter @klisteniapp/b2b-web build && node scripts/qa-b2b-anonymous-server.mjs',
    cwd: root,
    url: 'http://127.0.0.1:4348/',
    reuseExistingServer: process.env.QA_REUSE_SERVER === 'true',
    timeout: 180_000,
    gracefulShutdown: { signal: 'SIGTERM', timeout: 15000 },
  },
})
