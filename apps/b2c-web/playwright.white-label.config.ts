import { defineConfig, devices } from '@playwright/test'
import { fileURLToPath } from 'node:url'
import { readFileSync } from 'node:fs'
import { createHash, createPublicKey } from 'node:crypto'

const root = fileURLToPath(new URL('../..', import.meta.url))
const cert = readFileSync(`${root}/.cache/wl/tls/server.crt`)
const spki = createHash('sha256').update(createPublicKey(cert).export({ type: 'spki', format: 'der' })).digest('base64')
const chromium = { args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', `--ignore-certificate-errors-spki-list=${spki}`] }

export default defineConfig({
  testDir: './e2e', testMatch: 'white-label*.spec.ts', fullyParallel: false, workers: 1,
  forbidOnly: Boolean(process.env.CI), retries: 0, timeout: 90_000,
  outputDir: '../../.cache/wl/browser-results',
  reporter: [['list'], ['html', { outputFolder: '../../.cache/wl/browser-report', open: 'never' }]],
  use: { baseURL: 'https://atlas.b2b.test', reducedMotion: 'reduce', locale: 'es-AR', timezoneId: 'UTC',
    colorScheme: 'light', trace: 'retain-on-failure', screenshot: 'only-on-failure', ignoreHTTPSErrors: false },
  projects: [
    { name: 'wl-chromium-desktop', use: { browserName: 'chromium', launchOptions: chromium, proxy: { server: 'http://127.0.0.1:4342' }, viewport: { width: 1440, height: 1000 } } },
    { name: 'wl-chromium-touch', use: { ...devices['Pixel 7'], launchOptions: chromium, proxy: { server: 'http://127.0.0.1:4344' } } },
    { name: 'wl-webkit-touch', use: { ...devices['iPhone 13'], proxy: { server: 'http://127.0.0.1:4346' } } },
  ],
  webServer: {
    command: 'pnpm --filter @klisteniapp/b2b-web build && node scripts/b2b-wl-e2e-server.mjs',
    cwd: root, url: 'http://127.0.0.1:4348/', reuseExistingServer: false, timeout: 180_000,
    gracefulShutdown: { signal: 'SIGTERM', timeout: 15000 },
  },
})
