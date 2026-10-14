import { randomUUID } from 'node:crypto'
import { defineConfig } from '@playwright/test'

process.env.KLISTENI_ADMIN_SCHEMA ??= `klisteni_admin_${randomUUID().replaceAll('-', '')}`
const output = process.env.KLISTENI_ADMIN_BUILD_OUTPUT ??= `/tmp/klisteniapp-admin-build-${process.pid}`
const chromium = process.env.KLISTENI_CHROMIUM_EXECUTABLE
const webkit = process.env.KLISTENI_WEBKIT_EXECUTABLE
const launchOptions = (browserName: string) => {
  const executablePath = browserName === 'chromium' ? chromium : webkit
  return executablePath ? { launchOptions: { executablePath } } : {}
}
export default defineConfig({
  testDir: './e2e', testMatch: 'admin-accounts.spec.ts',
  outputDir: process.env.KLISTENI_ADMIN_RESULTS ?? '/tmp/klisteniapp-admin-results',
  fullyParallel: false, workers: 1, retries: 0, timeout: 60_000, forbidOnly: !!process.env.CI,
  reporter: [['list'], ['json', { outputFile: process.env.KLISTENI_ADMIN_REPORT ?? '/tmp/klisteniapp-admin-report.json' }]],
  use: { baseURL: 'http://127.0.0.1:4187', reducedMotion: 'reduce', trace: { mode: 'on', screenshots: false, snapshots: true, sources: true }, screenshot: 'only-on-failure' },
  projects: ['chromium', 'webkit'].flatMap(browserName => [
    { name: `${browserName}-narrow`, use: { browserName: browserName as 'chromium' | 'webkit', viewport: { width: 360, height: 780 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1, ...launchOptions(browserName) } },
    { name: `${browserName}-wide`, use: { browserName: browserName as 'chromium' | 'webkit', viewport: { width: 430, height: 932 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1, ...launchOptions(browserName) } },
    { name: `${browserName}-desktop`, use: { browserName: browserName as 'chromium' | 'webkit', viewport: { width: 1440, height: 1000 }, isMobile: false, hasTouch: false, ...launchOptions(browserName) } },
  ]),
  webServer: [
    { command: 'node ../../scripts/b2c-admin-fixtures.ts', url: 'http://127.0.0.1:4188/api/readyz', timeout: 120_000, reuseExistingServer: false, gracefulShutdown: { signal: 'SIGTERM', timeout: 10_000 } },
    { command: `pnpm exec vite build --outDir ${output} --emptyOutDir && pnpm exec vite preview --outDir ${output} --host 127.0.0.1 --port 4187 --strictPort`, env: { VITE_APP_MODE: 'instance', KLISTENI_PUBLIC_PROFILE_FILE: 'instance-profile.example.json', KLISTENI_API_URL: 'http://127.0.0.1:4188', VITE_UMAMI_SCRIPT_URL: '', VITE_UMAMI_HOST_URL: '', VITE_UMAMI_WEBSITE_ID: '', VITE_UMAMI_ALLOWED_HOSTNAME: '' }, url: 'http://127.0.0.1:4187', timeout: 120_000, reuseExistingServer: false, gracefulShutdown: { signal: 'SIGTERM', timeout: 10_000 } },
  ],
})
