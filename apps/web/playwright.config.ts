import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  testIgnore: 'analytics.spec.ts',
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
    // Use the Mac's native GPU for the same atlas rendered in the in-app browser.
    // Other platforms retain Chromium's default renderer.
    launchOptions: {
      args:
        process.platform === 'darwin'
          ? ['--enable-gpu', '--use-angle=metal']
          : [],
    },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'pnpm build && pnpm preview --host 127.0.0.1 --port 4174 --strictPort',
    env: { VITE_UMAMI_SCRIPT_URL: '', VITE_UMAMI_HOST_URL: '', VITE_UMAMI_WEBSITE_ID: '', VITE_UMAMI_ALLOWED_HOSTNAME: '' },
    timeout: 120_000,
    url: 'http://127.0.0.1:4174',
    reuseExistingServer: false,
  },
})
