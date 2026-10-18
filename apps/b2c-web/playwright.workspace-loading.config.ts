import { defineConfig } from '@playwright/test'

const port = Number(process.env.B2B_WORKSPACE_LOADING_PORT ?? 4298)

export default defineConfig({
  testDir: './test/workspace-loading',
  testMatch: 'workspace-loading.spec.ts',
  outputDir: process.env.B2B_WORKSPACE_LOADING_RESULTS ?? '/tmp/klisteni-workspace-loading-results',
  fullyParallel: false,
  forbidOnly: true,
  workers: 1,
  retries: 0,
  timeout: 30_000,
  expect: { timeout: 5_000 },
  reporter: [['list']],
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    browserName: 'chromium',
    launchOptions: { chromiumSandbox: true },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium430', use: { viewport: { width: 430, height: 932 } } },
    { name: 'chromium-desktop', use: { viewport: { width: 1440, height: 1000 } } },
  ],
  webServer: {
    command: 'node test/workspace-loading/server.mjs',
    url: `http://127.0.0.1:${port}/__fixture/ready`,
    reuseExistingServer: false,
  },
})
