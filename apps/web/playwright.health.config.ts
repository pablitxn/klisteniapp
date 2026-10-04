import { defineConfig } from '@playwright/test'
import base from './playwright.config'

// Keep health acceptance independent of ongoing atlas/preview work and builds.
const output = `/tmp/klisteniapp-health-build-${process.pid}`
export default defineConfig({
  ...base,
  testMatch: 'health.spec.ts',
  testIgnore: [],
  timeout: 30_000,
  outputDir: process.env.CI ? './test-results/health' : `/tmp/klisteniapp-health-results-${process.pid}`,
  use: {
    ...base.use,
    baseURL: 'http://127.0.0.1:43174',
    reducedMotion: 'reduce',
    launchOptions: { args: ['--disable-webgl'] },
  },
  webServer: {
    command: `pnpm exec vite build --outDir ${output} --emptyOutDir && pnpm exec vite preview --outDir ${output} --host 127.0.0.1 --port 43174 --strictPort`,
    env: { VITE_APP_MODE: 'instance', KLISTENI_PUBLIC_PROFILE_FILE: 'instance-profile.example.json', VITE_UMAMI_SCRIPT_URL: '', VITE_UMAMI_HOST_URL: '', VITE_UMAMI_WEBSITE_ID: '', VITE_UMAMI_ALLOWED_HOSTNAME: '' },
    timeout: 120_000,
    url: 'http://127.0.0.1:43174',
    reuseExistingServer: false,
  },
})
