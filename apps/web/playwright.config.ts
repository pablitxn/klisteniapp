import { defineConfig } from '@playwright/test'

// Browser validation owns its demo artifact, independently of operator builds.
const output = process.env.KLISTENI_DEMO_BUILD_OUTPUT ??= `/tmp/klisteniapp-demo-build-${process.pid}`

export default defineConfig({
  testDir: './e2e',
  testIgnore: ['analytics.spec.ts', 'accounts.spec.ts', 'subscriptions.spec.ts', 'account-access.spec.ts', 'forgot-password.spec.ts', 'health.spec.ts', 'ui-annotations-account.spec.ts', 'model-variant-account.spec.ts'],
  outputDir: process.env.CI ? './test-results' : `/tmp/klisteniapp-e2e-results-${process.pid}`,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  // Serialize full-atlas WebGL contexts; allow slower software-rendered CI runs.
  workers: 1,
  timeout: 90_000,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:4174',
    viewport: { width: 1440, height: 1000 },
    // Keep the real atlas but avoid continuous autoplay in CPU-bound CI.
    // Preview cases explicitly request no-preference to retain motion coverage.
    reducedMotion: process.env.CI ? 'reduce' : 'no-preference',
    // Use the Mac's native GPU for the same atlas rendered in the in-app browser.
    // Other platforms retain Chromium's default renderer.
    launchOptions: {
      args:
        process.platform === 'darwin'
          ? ['--enable-gpu', '--use-angle=metal']
          : [],
    },
    // Filmstrip readbacks stall software WebGL; retain DOM snapshots and source.
    trace: { mode: 'retain-on-failure', screenshots: false, snapshots: true, sources: true },
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: `pnpm exec vite build --outDir ${output} --emptyOutDir && pnpm exec vite preview --outDir ${output} --host 127.0.0.1 --port 4174 --strictPort`,
    env: { VITE_APP_MODE: 'demo', VITE_UMAMI_SCRIPT_URL: '', VITE_UMAMI_HOST_URL: '', VITE_UMAMI_WEBSITE_ID: '', VITE_UMAMI_ALLOWED_HOSTNAME: '' },
    timeout: 120_000,
    url: 'http://127.0.0.1:4174',
    reuseExistingServer: false,
  },
})
