import { defineConfig } from '@playwright/test'

// Synthetic DOM contracts only: no product server, database or full-matrix fixtures.
export default defineConfig({
  testDir: './e2e/support',
  testMatch: 'product-readiness.contract.spec.ts',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  forbidOnly: Boolean(process.env.CI),
  timeout: 40_000,
  outputDir: `/tmp/klisteni-product-readiness-${process.pid}`,
  reporter: 'list',
  use: {
    viewport: { width: 430, height: 932 },
    isMobile: true,
    hasTouch: true,
    locale: 'es-AR',
    timezoneId: 'UTC',
    ignoreHTTPSErrors: false,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'readiness-chromium-430',
      use: { browserName: 'chromium', launchOptions: { chromiumSandbox: true } },
    },
    { name: 'readiness-webkit-430', use: { browserName: 'webkit' } },
  ],
})
