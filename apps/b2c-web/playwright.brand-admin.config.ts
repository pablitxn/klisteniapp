import { defineConfig } from '@playwright/test'
import { fileURLToPath } from 'node:url'

// Historical QA used a self-signed fixture with TLS validation omitted.
// Future runs require valid HTTPS certificates or a separate HTTP loopback fixture.
// Do not bypass certificate checks or change the system/browser trust store.
const root = fileURLToPath(new URL('../..', import.meta.url))
const group = process.env.QA_ARTIFACT_GROUP ?? ''
if (group && !/^[a-z0-9-]+$/.test(group)) throw new Error('Invalid QA_ARTIFACT_GROUP')
const artifacts = `${root}/.cache/brand-admin${group ? `/${group}` : ''}`
const chromium = {
  executablePath: process.env.QA_CHROMIUM_PATH ?? '/usr/bin/chromium',
  args: ['--use-gl=angle', '--use-angle=swiftshader'],
}
export default defineConfig({
  testDir: './e2e',
  testMatch: 'brand-admin*.spec.ts',
  workers: 1,
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  timeout: 90_000,
  outputDir: `${artifacts}/results`,
  reporter: [
    ['list'],
    ['json', { outputFile: `${artifacts}/results.json` }],
    ['html', { outputFolder: `${artifacts}/report`, open: 'never' }],
  ],
  use: {
    baseURL: 'https://atlas.b2b.test',
    actionTimeout: 15_000,
    ignoreHTTPSErrors: false,
    reducedMotion: 'reduce',
    locale: 'es-AR',
    timezoneId: 'UTC',
    trace: 'on',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'admin-chromium-narrow',
      use: {
        browserName: 'chromium',
        launchOptions: chromium,
        proxy: { server: 'http://127.0.0.1:4342' },
        viewport: { width: 320, height: 740 },
        isMobile: true,
        hasTouch: true,
      },
    },
    {
      name: 'admin-chromium-wide',
      use: {
        browserName: 'chromium',
        launchOptions: chromium,
        proxy: { server: 'http://127.0.0.1:4344' },
        viewport: { width: 412, height: 915 },
        isMobile: true,
        hasTouch: true,
      },
    },
    {
      name: 'admin-chromium-desktop',
      use: {
        browserName: 'chromium',
        launchOptions: chromium,
        proxy: { server: 'http://127.0.0.1:4346' },
        viewport: { width: 1440, height: 1000 },
      },
    },
    {
      name: 'admin-webkit-touch',
      use: {
        browserName: 'webkit',
        launchOptions: { executablePath: process.env.QA_WEBKIT_PATH },
        proxy: { server: 'http://127.0.0.1:4350' },
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
      },
    },
  ],
  webServer: {
    command: 'pnpm --filter @klisteniapp/b2b-web build && node scripts/b2b-wl-e2e-server.mjs',
    cwd: root,
    env: { B2B_QA_EXTRA_PROXY: 'true' },
    url: 'http://127.0.0.1:4348/',
    reuseExistingServer: process.env.QA_REUSE_SERVER === 'true',
    timeout: 180_000,
    gracefulShutdown: { signal: 'SIGTERM', timeout: 15000 },
  },
})
