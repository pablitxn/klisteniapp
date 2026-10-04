import { defineConfig } from '@playwright/test'

// Each suite serves its own build, so other local UI work cannot replace it.
const output = process.env.KLISTENI_ACCOUNTS_BUILD_OUTPUT ??= `/tmp/klisteniapp-accounts-build-${process.pid}`

export default defineConfig({
  testDir: './e2e',
  testMatch: ['accounts.spec.ts', 'subscriptions.spec.ts', 'account-access.spec.ts', 'forgot-password.spec.ts', 'health.spec.ts'],
  outputDir: process.env.CI ? './accounts-test-results' : `/tmp/klisteniapp-accounts-results-${process.pid}`,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  timeout: 60_000,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:4181',
    viewport: { width: 1440, height: 1000 },
    reducedMotion: 'reduce',
    trace: { mode: 'retain-on-failure', screenshots: false, snapshots: true, sources: true },
    screenshot: 'only-on-failure',
  },
  webServer: [
    {
      command: 'node ../../scripts/accounts-e2e-server.ts',
      url: 'http://127.0.0.1:4182/api/readyz',
      timeout: 120_000,
      reuseExistingServer: false,
      gracefulShutdown: { signal: 'SIGTERM', timeout: 10_000 },
    },
    {
      command: `pnpm exec vite build --outDir ${output} --emptyOutDir && pnpm exec vite preview --outDir ${output} --host 127.0.0.1 --port 4181 --strictPort`,
      env: { VITE_APP_MODE: 'instance', KLISTENI_PUBLIC_PROFILE_FILE: 'instance-profile.example.json',
        KLISTENI_API_URL: 'http://127.0.0.1:4182',
        VITE_UMAMI_SCRIPT_URL: '', VITE_UMAMI_HOST_URL: '', VITE_UMAMI_WEBSITE_ID: '', VITE_UMAMI_ALLOWED_HOSTNAME: '',
      },
      timeout: 120_000,
      url: 'http://127.0.0.1:4181',
      reuseExistingServer: false,
      gracefulShutdown: { signal: 'SIGTERM', timeout: 10_000 },
    },
  ],
})
