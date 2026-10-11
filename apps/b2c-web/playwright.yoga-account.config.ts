import { defineConfig } from '@playwright/test'

// Instance browser acceptance with a mocked transport; no database is required.
const output = process.env.KLISTENI_YOGA_ACCOUNT_BUILD_OUTPUT ??= `/tmp/klisteniapp-yoga-account-build-${process.pid}`

export default defineConfig({
  testDir: './e2e',
  testMatch: 'yoga-account.spec.ts',
  outputDir: process.env.CI ? './yoga-account-test-results' : `/tmp/klisteniapp-yoga-account-results-${process.pid}`,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  timeout: 45_000,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:4189',
    viewport: { width: 1440, height: 1000 },
    reducedMotion: 'reduce',
    launchOptions: { args: ['--disable-webgl'] },
    trace: { mode: 'retain-on-failure', screenshots: false, snapshots: true, sources: true },
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: `pnpm exec vite build --outDir ${output} --emptyOutDir && pnpm exec vite preview --outDir ${output} --host 127.0.0.1 --port 4189 --strictPort`,
    env: {
      VITE_APP_MODE: 'instance', KLISTENI_PUBLIC_PROFILE_FILE: 'instance-profile.example.json',
      VITE_UMAMI_SCRIPT_URL: '', VITE_UMAMI_HOST_URL: '', VITE_UMAMI_WEBSITE_ID: '', VITE_UMAMI_ALLOWED_HOSTNAME: '',
    },
    timeout: 120_000,
    url: 'http://127.0.0.1:4189',
    reuseExistingServer: false,
    gracefulShutdown: { signal: 'SIGTERM', timeout: 10_000 },
  },
})
