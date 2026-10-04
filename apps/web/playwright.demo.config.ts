import { defineConfig } from '@playwright/test'
import base from './playwright.config'

const output = process.env.KLISTENI_DEMO_BUILD_OUTPUT ??= `/tmp/klisteniapp-demo-build-${process.pid}`
export default defineConfig({
  ...base,
  testMatch: 'demo.spec.ts',
  timeout: 45_000,
  use: { ...base.use, baseURL: 'http://127.0.0.1:4176', reducedMotion: 'reduce', launchOptions: { args: ['--disable-webgl'] } },
  webServer: {
    command: `pnpm exec vite build --outDir ${output} --emptyOutDir && pnpm exec vite preview --outDir ${output} --host 127.0.0.1 --port 4176 --strictPort`,
    env: {
      VITE_APP_MODE: 'demo',
      KLISTENI_PUBLIC_PROFILE_FILE: '/deliberately-missing-demo-profile.json',
      VITE_UMAMI_SCRIPT_URL: 'https://unused.example.test/tracker.js', VITE_UMAMI_HOST_URL: 'https://unused.example.test',
      VITE_UMAMI_WEBSITE_ID: '00000000-0000-4000-8000-000000000099', VITE_UMAMI_ALLOWED_HOSTNAME: '127.0.0.1',
    },
    url: 'http://127.0.0.1:4176', reuseExistingServer: false, timeout: 120_000,
  },
})
