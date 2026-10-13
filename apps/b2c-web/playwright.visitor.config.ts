import { defineConfig } from '@playwright/test'

// The visitor suite never authenticates. Instance mode uses the disposable
// accounts fixture, with billing and mail disabled by that fixture.
const instance = process.env.VISITOR_INSTANCE === '1'
const output = process.env.VISITOR_BUILD_OUTPUT ??= `/tmp/klisteni-visitor-${instance ? 'instance' : 'demo'}-${process.pid}`
const baseURL = process.env.VISITOR_URL ?? (instance ? 'http://127.0.0.1:4181' : 'http://127.0.0.1:4174')
const broad = process.env.VISITOR_EXISTING === '1'
if (broad && !instance && process.env.VISITOR_EXTERNAL_SERVER !== '1') process.env.KLISTENI_DEMO_BUILD_OUTPUT ??= output
const run = process.env.VISITOR_RUN ?? `${instance ? 'instance' : 'demo'}${broad ? '-existing' : ''}-${process.pid}`
const browsers = process.env.VISITOR_BROWSERS?.split(',') ?? ['chromium', 'webkit']
const viewports = broad ? [{ name: 'desktop', width: 1440, height: 1000, touch: false }] : [
  { name: 'narrow', width: 320, height: 740, touch: true },
  { name: 'mobile', width: 430, height: 932, touch: true },
  { name: 'desktop', width: 1440, height: 1000, touch: false },
]

export default defineConfig({
  testDir: './e2e',
  testMatch: broad ? ['app.spec.ts', 'settings.spec.ts', 'demo.spec.ts', 'yoga.spec.ts', 'learning-library.spec.ts', 'catalog-expansion.spec.ts', 'body-guide.spec.ts', 'exercise-planning.spec.ts', 'fallback.spec.ts', 'themes.spec.ts', 'ui-annotations.spec.ts', 'model-variant.spec.ts', 'anatomy.spec.ts', 'yoga-3d.spec.ts'] : 'visitor-local.spec.ts',
  outputDir: `../../artifacts/visitor-qa/${run}`,
  reporter: [['list'], ['json', { outputFile: `../../artifacts/visitor-qa/${run}-results.json` }]],
  workers: 1,
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL,
    reducedMotion: 'reduce',
    trace: { mode: 'on', screenshots: false, snapshots: true, sources: true },
    screenshot: 'only-on-failure',
  },
  projects: browsers.flatMap(browserName => viewports.map(viewport => ({
    name: `${browserName}-${viewport.name}`,
    use: {
      browserName: browserName as 'chromium' | 'webkit',
      viewport: { width: viewport.width, height: viewport.height },
      hasTouch: viewport.touch,
      isMobile: viewport.touch,
      launchOptions: {
        ...((browserName === 'chromium' ? process.env.VISITOR_CHROMIUM_PATH : process.env.VISITOR_WEBKIT_PATH)
          ? { executablePath: browserName === 'chromium' ? process.env.VISITOR_CHROMIUM_PATH : process.env.VISITOR_WEBKIT_PATH } : {}),
      },
    },
  }))),
  webServer: process.env.VISITOR_EXTERNAL_SERVER === '1' ? undefined : [
    ...(instance ? [{ command: 'node ../../scripts/accounts-e2e-server.ts', url: 'http://127.0.0.1:4182/api/readyz', timeout: 120_000, reuseExistingServer: false, gracefulShutdown: { signal: 'SIGTERM' as const, timeout: 10_000 } }] : []),
    {
      command: `pnpm exec vite build --outDir ${output} --emptyOutDir && pnpm exec vite preview --outDir ${output} --host 127.0.0.1 --port ${instance ? '4181' : '4174'} --strictPort`,
      url: baseURL, timeout: 120_000, reuseExistingServer: false,
      env: { VITE_APP_MODE: instance ? 'instance' : 'demo', KLISTENI_PUBLIC_PROFILE_FILE: 'instance-profile.example.json', KLISTENI_API_URL: 'http://127.0.0.1:4182', VITE_UMAMI_SCRIPT_URL: '', VITE_UMAMI_HOST_URL: '', VITE_UMAMI_WEBSITE_ID: '', VITE_UMAMI_ALLOWED_HOSTNAME: '', KLISTENI_DEMO_BUILD_OUTPUT: output },
      gracefulShutdown: { signal: 'SIGTERM' as const, timeout: 10_000 },
    },
  ],
})
