import { defineConfig } from '@playwright/test'

process.env.KLISTENI_ANALYTICS_E2E = '1'
const output = '/tmp/klisteniapp-analytics-e2e'
export default defineConfig({
  testDir: './e2e', testMatch: 'analytics.spec.ts', workers: 2,
  fullyParallel: true, forbidOnly: !!process.env.CI, retries: process.env.CI ? 1 : 0,
  timeout: 30_000, reporter: 'list', outputDir: process.env.CI ? './analytics-test-results' : '/tmp/klisteniapp-analytics-results',
  use: { baseURL: 'http://127.0.0.1:4175', viewport: { width: 1440, height: 1000 }, trace: 'retain-on-failure', screenshot: 'only-on-failure', launchOptions: { args: ['--disable-webgl'] } },
  webServer: {
    command: `pnpm exec vite build --outDir ${output} --emptyOutDir && pnpm exec vite preview --outDir ${output} --host 127.0.0.1 --port 4175 --strictPort`,
    env: { VITE_APP_MODE: 'instance', KLISTENI_PUBLIC_PROFILE_FILE: 'instance-profile.example.json', VITE_UMAMI_SCRIPT_URL: '/umami/script.js', VITE_UMAMI_HOST_URL: '/umami', VITE_UMAMI_WEBSITE_ID: '00000000-0000-4000-8000-000000000001', VITE_UMAMI_ALLOWED_HOSTNAME: '127.0.0.1' },
    url: 'http://127.0.0.1:4175', reuseExistingServer: false, timeout: 120_000,
  },
})
