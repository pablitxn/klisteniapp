import { defineConfig } from '@playwright/test'
import { fileURLToPath } from 'node:url'
const root = fileURLToPath(new URL('../..', import.meta.url))
const role = process.env.QA_INTEGRATION_ROLE ?? 'member'
const matches: Record<string, string | string[]> = {
  member: 'member-qa.spec.ts',
  trainer: 'b2b-trainer.spec.ts',
  anonymous: 'b2b-anonymous.spec.ts',
  'brand-admin': ['brand-admin.spec.ts', 'brand-admin-regressions.spec.ts'],
}
if (!matches[role]) throw new Error('Unknown integration role')
process.env.QA_INTEGRATION_HTTP = '1'
const output =
  process.env.QA_INTEGRATION_OUTPUT ?? `/tmp/klisteni-integration-${role}-${process.pid}`
const views =
  role === 'brand-admin'
    ? [
        { name: 'chromium-narrow', engine: 'chromium', width: 320, height: 740, touch: true },
        { name: 'chromium-wide', engine: 'chromium', width: 412, height: 915, touch: true },
        { name: 'chromium-desktop', engine: 'chromium', width: 1440, height: 1000, touch: false },
        { name: 'webkit-narrow', engine: 'webkit', width: 390, height: 844, touch: true },
      ]
    : ['chromium', 'webkit'].flatMap((engine) => [
        {
          name: `${engine}-narrow`,
          engine,
          width: role === 'member' ? 320 : 360,
          height: role === 'member' ? 740 : 800,
          touch: true,
        },
        { name: `${engine}-wide`, engine, width: 430, height: 932, touch: true },
        { name: `${engine}-desktop`, engine, width: 1440, height: 1000, touch: false },
      ])
export default defineConfig({
  testDir: './e2e',
  testMatch: matches[role],
  workers: 1,
  fullyParallel: false,
  retries: 0,
  forbidOnly: !!process.env.CI,
  timeout: 180_000,
  outputDir: output,
  reporter: [['list'], ['json', { outputFile: `${output}/report.json` }]],
  use: {
    baseURL: 'http://atlas.b2b.test',
    ignoreHTTPSErrors: false,
    reducedMotion: 'reduce',
    locale: 'es-AR',
    timezoneId: 'UTC',
    trace: { mode: 'on', screenshots: false, snapshots: true, sources: true },
    screenshot: 'only-on-failure',
  },
  projects: views.map((view, index) => ({
    name: `${role}-${view.name}`,
    metadata: { fixtureIndex: index, protocol: 'http' },
    use: {
      browserName: view.engine as 'chromium' | 'webkit',
      viewport: { width: view.width, height: view.height },
      hasTouch: view.touch,
      isMobile: view.touch,
      proxy: { server: `http://127.0.0.1:${[4342, 4344, 4346, 4350, 4352, 4354][index]}` },
      launchOptions: {
        executablePath:
          view.engine === 'chromium'
            ? process.env.QA_INTEGRATION_CHROMIUM
            : process.env.QA_INTEGRATION_WEBKIT,
      },
    },
  })),
  webServer: {
    command:
      'pnpm --filter @klisteniapp/b2b-web build && node scripts/b2b-integration-e2e-server.mjs',
    cwd: root,
    url: 'http://127.0.0.1:4348/',
    timeout: 180_000,
    reuseExistingServer: false,
    gracefulShutdown: { signal: 'SIGTERM', timeout: 15000 },
  },
})
